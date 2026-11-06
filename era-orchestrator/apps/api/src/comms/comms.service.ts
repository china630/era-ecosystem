import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  NotificationChannel,
  NotificationMessageClass,
  NotificationOutboxStatus,
  Prisma,
} from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../platform/notifications/notifications.service";
import { NotificationsOutboxWorker } from "../platform/notifications/notifications-outbox.worker";
import type { CreateCommsThreadDto } from "./dto/comms.dto";

@Injectable()
export class CommsService {
  private readonly logger = new Logger(CommsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly outboxWorker: NotificationsOutboxWorker,
  ) {}

  private async assertMembership(organizationId: string, userId: string) {
    const m = await this.prisma.organizationMembership.findFirst({
      where: { organizationId, userId, deletedAt: null },
      select: { userId: true },
    });
    if (!m) {
      throw new ForbiddenException("Not a member of this organization");
    }
  }

  async listRecipients(organizationId: string, userId: string) {
    await this.assertMembership(organizationId, userId);
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { organizationId, deletedAt: null },
      select: { userId: true },
    });
    const ids = memberships.map((m) => m.userId);
    if (ids.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true },
      orderBy: { email: "asc" },
    });
    return users.map((u) => ({
      userId: u.id,
      email: u.email,
    }));
  }

  async listThreads(organizationId: string, userId: string) {
    await this.assertMembership(organizationId, userId);
    const parts = await this.prisma.commsParticipant.findMany({
      where: { userId, thread: { organizationId } },
      include: {
        thread: {
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { body: true, createdAt: true, authorUserId: true },
            },
            _count: { select: { messages: true } },
          },
        },
      },
      orderBy: { thread: { updatedAt: "desc" } },
    });
    return parts.map((p) => ({
      id: p.thread.id,
      subject: p.thread.subject,
      authorUserId: p.thread.authorUserId,
      updatedAt: p.thread.updatedAt,
      createdAt: p.thread.createdAt,
      messageCount: p.thread._count.messages,
      lastMessage: p.thread.messages[0] ?? null,
      unread: p.readAt == null,
      readAt: p.readAt,
    }));
  }

  async getThread(organizationId: string, userId: string, threadId: string) {
    await this.assertMembership(organizationId, userId);
    const thread = await this.prisma.commsThread.findFirst({
      where: { id: threadId, organizationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            body: true,
            authorUserId: true,
            createdAt: true,
          },
        },
        participants: {
          select: { userId: true, readAt: true },
        },
      },
    });
    if (!thread) {
      throw new NotFoundException("Thread not found");
    }
    const isParticipant = thread.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      throw new ForbiddenException("Not a participant of this thread");
    }
    return thread;
  }

  async createThread(
    organizationId: string,
    userId: string,
    dto: CreateCommsThreadDto,
  ) {
    await this.assertMembership(organizationId, userId);
    const recipientIds = [
      ...new Set(
        dto.recipientUserIds
          .map((id) => id.trim())
          .filter((id) => id.length > 0 && id !== userId),
      ),
    ];
    if (recipientIds.length === 0) {
      throw new BadRequestException("At least one recipient is required");
    }

    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId,
        userId: { in: recipientIds },
        deletedAt: null,
      },
      select: { userId: true },
    });
    if (memberships.length !== recipientIds.length) {
      throw new ForbiddenException(
        "All recipients must be active members of this organization",
      );
    }

    const participantUserIds = [...new Set([userId, ...recipientIds])];

    const thread = await this.prisma.$transaction(async (tx) => {
      const created = await tx.commsThread.create({
        data: {
          organizationId,
          subject: dto.subject.trim(),
          authorUserId: userId,
          messages: {
            create: {
              authorUserId: userId,
              body: dto.body.trim(),
            },
          },
          participants: {
            create: participantUserIds.map((uid) => ({
              userId: uid,
              readAt: uid === userId ? new Date() : null,
            })),
          },
        },
        include: {
          messages: { orderBy: { createdAt: "asc" }, take: 1 },
          participants: { select: { userId: true, readAt: true } },
        },
      });
      return created;
    });

    const firstMessage = thread.messages[0];
    if (firstMessage) {
      await this.deliverMessage({
        organizationId,
        threadId: thread.id,
        messageId: firstMessage.id,
        subject: thread.subject,
        body: firstMessage.body,
        authorUserId: userId,
        recipientUserIds: recipientIds,
      });
    }

    return thread;
  }

  async reply(
    organizationId: string,
    userId: string,
    threadId: string,
    body: string,
  ) {
    await this.assertMembership(organizationId, userId);
    const thread = await this.prisma.commsThread.findFirst({
      where: { id: threadId, organizationId },
      include: { participants: { select: { userId: true } } },
    });
    if (!thread) {
      throw new NotFoundException("Thread not found");
    }
    if (!thread.participants.some((p) => p.userId === userId)) {
      throw new ForbiddenException("Not a participant of this thread");
    }

    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException("Message body is required");
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.commsMessage.create({
        data: {
          threadId,
          authorUserId: userId,
          body: trimmed,
        },
      });
      await tx.commsThread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() },
      });
      await tx.commsParticipant.updateMany({
        where: { threadId, userId: { not: userId } },
        data: { readAt: null },
      });
      await tx.commsParticipant.updateMany({
        where: { threadId, userId },
        data: { readAt: new Date() },
      });
      return msg;
    });

    const recipients = thread.participants
      .map((p) => p.userId)
      .filter((id) => id !== userId);

    await this.deliverMessage({
      organizationId,
      threadId,
      messageId: message.id,
      subject: thread.subject,
      body: trimmed,
      authorUserId: userId,
      recipientUserIds: recipients,
    });

    return message;
  }

  async markRead(organizationId: string, userId: string, threadId: string) {
    await this.assertMembership(organizationId, userId);
    const thread = await this.prisma.commsThread.findFirst({
      where: { id: threadId, organizationId },
      select: { id: true },
    });
    if (!thread) {
      throw new NotFoundException("Thread not found");
    }
    const updated = await this.prisma.commsParticipant.updateMany({
      where: { threadId, userId },
      data: { readAt: new Date() },
    });
    if (updated.count === 0) {
      throw new ForbiddenException("Not a participant of this thread");
    }
    return { ok: true as const };
  }

  private async deliverMessage(input: {
    organizationId: string;
    threadId: string;
    messageId: string;
    subject: string;
    body: string;
    authorUserId: string;
    recipientUserIds: string[];
  }) {
    if (input.recipientUserIds.length === 0) return;

    const users = await this.prisma.user.findMany({
      where: { id: { in: input.recipientUserIds } },
      select: { id: true, email: true },
    });

    for (const user of users) {
      await this.enqueueInApp({
        organizationId: input.organizationId,
        userId: user.id,
        threadId: input.threadId,
        messageId: input.messageId,
        subject: input.subject,
        body: input.body,
      });

      if (user.email?.includes("@")) {
        try {
          await this.notifications.send(input.organizationId, {
            templateKey: "comms.message",
            channel: NotificationChannel.EMAIL,
            messageClass: NotificationMessageClass.TRANSACTIONAL,
            recipient: user.email,
            sourceEntityType: "comms_message",
            sourceEntityId: `${input.messageId}:${user.id}`,
            subject: `Comms: ${input.subject}`,
            body: input.body,
            payload: {
              threadId: input.threadId,
              messageId: input.messageId,
            },
          });
        } catch (err) {
          this.logger.warn(
            `Comms email skipped for ${user.id}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }
  }

  /** Bell delivery without platform_notifications entitlement gate. */
  private async enqueueInApp(input: {
    organizationId: string;
    userId: string;
    threadId: string;
    messageId: string;
    subject: string;
    body: string;
  }) {
    try {
      const existing = await this.prisma.notificationOutbox.findUnique({
        where: {
          organizationId_sourceEntityType_sourceEntityId_templateKey: {
            organizationId: input.organizationId,
            sourceEntityType: "comms_message_in_app",
            sourceEntityId: `${input.messageId}:${input.userId}`,
            templateKey: "comms.message.in_app",
          },
        },
      });
      if (existing) return;

      const outbox = await this.prisma.notificationOutbox.create({
        data: {
          organizationId: input.organizationId,
          templateKey: "comms.message.in_app",
          messageClass: NotificationMessageClass.TRANSACTIONAL,
          channel: NotificationChannel.IN_APP,
          recipient: `user:${input.userId}`,
          payload: {
            subject: input.subject,
            body: input.body,
            threadId: input.threadId,
            messageId: input.messageId,
          } as Prisma.InputJsonValue,
          sourceEntityType: "comms_message_in_app",
          sourceEntityId: `${input.messageId}:${input.userId}`,
          status: NotificationOutboxStatus.PENDING,
        },
      });
      await this.outboxWorker.enqueueOutbox(outbox.id, input.organizationId);
    } catch (err) {
      this.logger.warn(
        `Comms in-app notify failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
