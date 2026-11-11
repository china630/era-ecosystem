import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_MUTATION_AUDIT_EXEMPT_PREFIXES,
  HTTP_MUTATION_ENTITY_TYPE,
  buildHttpMutationChanges,
  inferActorKind,
  inferMutationEntityId,
  isHttpMutationMethod,
  isMutationAuditExemptPath,
} from "./mutation-audit-belt";

describe("mutation-audit-belt", () => {
  it("detects HTTP mutation methods", () => {
    assert.equal(isHttpMutationMethod("POST"), true);
    assert.equal(isHttpMutationMethod("get"), false);
    assert.equal(isHttpMutationMethod(null), false);
  });

  it("exempts auth and health paths", () => {
    assert.equal(isMutationAuditExemptPath("/api/auth/login"), true);
    assert.equal(isMutationAuditExemptPath("/api/auth/login/extra"), true);
    assert.equal(isMutationAuditExemptPath("/api/health"), true);
    assert.equal(isMutationAuditExemptPath("/api/locale"), true);
    assert.equal(isMutationAuditExemptPath("/api/healthcare"), false);
    assert.equal(isMutationAuditExemptPath("/api/reservations"), false);
    assert.equal(
      isMutationAuditExemptPath("/api/custom/skip", ["/api/custom/skip"]),
      true,
    );
  });

  it("infers entity id from uuid or last segment", () => {
    const id = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
    assert.equal(inferMutationEntityId(`/api/reservations/${id}/check-out`), id);
    assert.equal(inferMutationEntityId("/api/admin/roles"), "roles");
  });

  it("infers actor kind", () => {
    assert.equal(inferActorKind({ pathname: "/api/internal/v1/x" }), "SERVICE");
    assert.equal(
      inferActorKind({ pathname: "/api/agency/book", userActorHeader: "agency" }),
      "AGENCY",
    );
    assert.equal(inferActorKind({ pathname: "/api/folios/pay" }), "USER");
  });

  it("builds Layer A changes payload", () => {
    const changes = buildHttpMutationChanges({
      method: "post",
      path: "/api/x",
      statusCode: 201,
      actorKind: "USER",
    });
    assert.deepEqual(changes, {
      method: "POST",
      path: "/api/x",
      statusCode: 201,
      actorKind: "USER",
    });
    assert.equal(HTTP_MUTATION_ENTITY_TYPE, "HTTP_MUTATION");
    assert.ok(DEFAULT_MUTATION_AUDIT_EXEMPT_PREFIXES.length > 0);
  });
});
