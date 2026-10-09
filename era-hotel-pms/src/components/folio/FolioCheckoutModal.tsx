'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  Field,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { accountBalance } from '@/lib/folio-payer';

const TENDERS = ['CASH', 'CARD', 'BANK_TRANSFER', 'DEPOSIT', 'LOYALTY_POINTS', 'COMPANY_ACCOUNT'] as const;

type FolioRow = {
  id: string;
  type: string;
  status: string;
  charges: Array<{ amount: number | string; qty?: number | null }>;
  payments?: Array<{ amount: number | string; kind?: string | null }>;
};

type EarlyPreview = {
  applicable: boolean;
  unusedNights: number;
  unusedSellGross: number;
  vatWithheld: number;
  guestCashRefund: number;
};

export function FolioCheckoutModal({
  open,
  onClose,
  onDone,
  reservationId,
  folios,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  reservationId: string;
  folios: FolioRow[];
}) {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const tPay = useTranslations('paymentMethod');
  const tHk = useTranslations('housekeeping');
  const guest = folios.find((f) => f.type === 'GUEST' && f.status === 'OPEN') ?? folios.find((f) => f.type === 'GUEST');
  const balance = guest ? accountBalance(guest) : 0;
  const [transferToCl, setTransferToCl] = useState(true);
  const [heldDeposits, setHeldDeposits] = useState(0);
  const [applyDeposits, setApplyDeposits] = useState(true);
  const [discountAmount, setDiscountAmount] = useState('');
  const [lines, setLines] = useState<{ method: string; amount: string; bankReference: string }[]>([
    { method: 'CASH', amount: '', bankReference: '' },
  ]);
  const [early, setEarly] = useState<EarlyPreview | null>(null);
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [refundReason, setRefundReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [laundry, setLaundry] = useState<Array<{ id: string; guestName: string }>>([]);
  const [laundryScan, setLaundryScan] = useState('');

  useEffect(() => {
    if (!open) return;
    setTransferToCl(true);
    setEarly(null);
    setRefundMethod('CASH');
    setRefundReason('');
    void fetch(`/api/reservations/${reservationId}/early-checkout-preview`)
      .then((r) => r.json())
      .then((data) => {
        const payload = data.data ?? data;
        if (!payload) return;
        setEarly({
          applicable: !!payload.applicable,
          unusedNights: Number(payload.unusedNights) || 0,
          unusedSellGross: Number(payload.unusedSellGross) || 0,
          vatWithheld: Number(payload.vatWithheld) || 0,
          guestCashRefund: Number(payload.guestCashRefund) || 0,
        });
      })
      .catch(() => null);
    if (guest) {
      void fetch(`/api/folios/settle?folioId=${guest.id}`)
        .then((r) => r.json())
        .then((data) => {
          const payload = data.data ?? data;
          if (payload?.heldDeposits != null) setHeldDeposits(Number(payload.heldDeposits));
        })
        .catch(() => null);
    }
  }, [open, reservationId, guest?.id]);

  async function settleThenCheckout() {
    if (guest && balance > 0.01 && !transferToCl) {
      const tender = lines
        .map((l) => ({
          method: l.method,
          amount: Number(l.amount),
          bankReference: l.method === 'BANK_TRANSFER' && l.bankReference.trim() ? l.bankReference.trim() : undefined,
        }))
        .filter((l) => l.amount > 0);
      if (tender.length === 0 && applyDeposits && heldDeposits > 0.01) {
        tender.push({ method: 'DEPOSIT', amount: heldDeposits, bankReference: undefined });
      }
      if (tender.length > 0) {
        const res = await fetch('/api/folios/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folioId: guest.id,
            lines: tender,
            applyDeposits,
            discountAmount: discountAmount ? Number(discountAmount) : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, tc('error'));
          return false;
        }
      }
    }
    const res = await fetch(`/api/reservations/${reservationId}/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transferToCityLedger: transferToCl,
        discountAmount: discountAmount ? Number(discountAmount) : undefined,
        unusedNightsRefundMethod: early?.applicable && early.guestCashRefund > 0 ? refundMethod : undefined,
        unusedNightsReason: early?.applicable && refundReason.trim() ? refundReason.trim() : undefined,
      }),
    });
    const data = await res.json();
    const payload = data.data ?? data;
    if (res.ok) {
      showSuccess(
        payload.cityLedgerTransferred?.length
          ? t('checkoutClSuccess', { count: payload.cityLedgerTransferred.length })
          : t('checkoutSuccess'),
      );
      onDone?.();
      onClose();
      return true;
    }
    if (payload.code === 'LAUNDRY_OPEN' && Array.isArray(payload.tickets)) {
      setLaundry(payload.tickets);
      onClose();
      return false;
    }
    showApiError(data, tc('error'));
    return false;
  }

  return (
    <>
      <EraModal
        open={open}
        title={t('checkOut')}
        onClose={onClose}
        footer={
          <EraModalFooter
            onCancel={onClose}
            onSubmit={() => {
              setBusy(true);
              void settleThenCheckout().finally(() => setBusy(false));
            }}
            busy={busy}
            submitLabel={t('confirmCheckout')}
          />
        }
      >
        <div className="space-y-3 text-[13px] text-[#34495E]">
          <p className="m-0">
            {t('totalBalance')} <strong>{balance.toFixed(2)} AZN</strong>{' '}
            {Math.abs(balance) < 0.01 ? t('readyCheckout') : t('paymentRequired')}
          </p>
          <CatalogField
            kind="OPS_HOT"
            label={t('checkoutMode')}
            value={transferToCl ? 'CL' : 'GUEST'}
            onChange={(v) => setTransferToCl(String(v) === 'CL')}
            options={[
              { value: 'CL', label: t('leaveOnCityLedger') },
              { value: 'GUEST', label: t('payGuestFirst') },
            ]}
            emptyLabel={null}
          />
          <p className="m-0 text-[12px] text-[#7F8C8D]">
            {transferToCl ? t('leaveOnCityLedgerHint') : t('payGuestFirstHint')}
          </p>
          {!transferToCl && balance > 0.01 && guest ? (
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-2">
                  <CatalogField
                    kind="CLOSED_SMALL"
                    label={t('method')}
                    value={line.method}
                    onChange={(v) => {
                      const next = [...lines];
                      next[idx] = { ...next[idx]!, method: String(v ?? 'CASH') };
                      setLines(next);
                    }}
                    options={TENDERS.map((m) => ({ value: m, label: tPay(m) }))}
                    emptyLabel={null}
                  />
                  <Field
                    label={tc('amount')}
                    preset="amount"
                    type="number"
                    value={line.amount}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...next[idx]!, amount: e.target.value };
                      setLines(next);
                    }}
                  />
                  {line.method === 'BANK_TRANSFER' ? (
                    <Field
                      label={t('bankReference')}
                      preset="longText"
                      value={line.bankReference}
                      onChange={(e) => {
                        const next = [...lines];
                        next[idx] = { ...next[idx]!, bankReference: e.target.value };
                        setLines(next);
                      }}
                    />
                  ) : null}
                </div>
              ))}
              <Field
                label={t('discountAzn')}
                preset="amount"
                type="number"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
              <label className="inline-flex items-center gap-1.5 text-[12px]">
                <input
                  type="checkbox"
                  checked={applyDeposits}
                  onChange={(e) => setApplyDeposits(e.target.checked)}
                />
                {t('applyHeldDeposits')}
                {heldDeposits > 0 ? ` (${heldDeposits.toFixed(2)} AZN)` : ''}
              </label>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setLines([...lines, { method: 'CASH', amount: '', bankReference: '' }])}
              >
                {t('addTenderLine')}
              </button>
            </div>
          ) : null}
          {early?.applicable ? (
            <div className="space-y-1 rounded border border-[#D5DADF] bg-[#F8FAFC] p-3">
              <p className="m-0 font-medium">{t('earlyCheckoutTitle')}</p>
              <p className="m-0">{t('earlyCheckoutNights', { count: early.unusedNights })}</p>
              <p className="m-0">{t('earlyCheckoutGross', { amount: early.unusedSellGross.toFixed(2) })}</p>
              <p className="m-0">{t('earlyCheckoutVat', { amount: early.vatWithheld.toFixed(2) })}</p>
              <p className="m-0">{t('earlyCheckoutCash', { amount: early.guestCashRefund.toFixed(2) })}</p>
              {early.guestCashRefund > 0 ? (
                <>
                  <CatalogField
                    kind="OPS_HOT"
                    label={t('earlyCheckoutTender')}
                    value={refundMethod}
                    onChange={(v) => setRefundMethod(String(v ?? 'CASH'))}
                    options={[
                      { value: 'CASH', label: tPay('CASH') },
                      { value: 'CARD', label: tPay('CARD') },
                    ]}
                    emptyLabel={null}
                  />
                  <Field
                    label={t('earlyCheckoutReason')}
                    preset="shortText"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                  />
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </EraModal>
      <EraModal open={laundry.length > 0} title={tHk('laundryOpenCheckout')} onClose={() => setLaundry([])}>
        <ul className="mb-3 text-[13px]">
          {laundry.map((tk) => (
            <li key={tk.id}>{tk.guestName}</li>
          ))}
        </ul>
        <input
          type="file"
          className="mb-2 text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setLaundryScan(String(reader.result ?? file.name));
            reader.readAsDataURL(file);
          }}
        />
        <EraModalFooter
          onCancel={() => setLaundry([])}
          cancelLabel={tHk('waitLaundry')}
          submitLabel={tHk('deliverLaundry')}
          onSubmit={() => {
            const first = laundry[0];
            if (!first || !laundryScan) {
              showApiError({ error: tHk('returnScanRequired') }, tc('error'));
              return;
            }
            void fetch('/api/housekeeping/laundry', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ deliverTicketId: first.id, returnScanKey: laundryScan, actorRole: 'FO' }),
            }).then(async (res) => {
              if (!res.ok) showApiError(await res.json(), tc('error'));
              else {
                showSuccess(tc('saved'));
                setLaundry([]);
                onDone?.();
              }
            });
          }}
        />
      </EraModal>
    </>
  );
}
