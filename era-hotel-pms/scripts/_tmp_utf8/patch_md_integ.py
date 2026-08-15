import re
import pathlib

ROOT = pathlib.Path(r"d:/My Projects/era-ecosystem/era-hotel-pms/app/admin")


def load(path: pathlib.Path) -> str:
    data = path.read_bytes()
    if len(data) > 1 and data[1] == 0:
        text = data.decode("utf-16-le").lstrip("\ufeff")
    else:
        text = data.decode("utf-8")
    return text.replace("\r\n", "\n")


def save(path: pathlib.Path, text: str) -> None:
    path.write_text(text, encoding="utf-8", newline="\n")
    check = path.read_bytes()
    assert check[1] != 0, f"utf16 left in {path}"
    print("saved", path)


def patch_master_data() -> None:
    p = ROOT / "master-data" / "page.tsx"
    s = load(p)

    s = re.sub(
        r"setMsg\((edit\w+) \? t\('([^']+)'\) : t\('([^']+)'\);",
        r"showSuccess(\1 ? t('\2') : t('\3'));",
        s,
    )
    s = s.replace(
        "setMsg(wasEdit ? t('roomUpdated', { room: roomNum }) : t('roomCreated', { room: roomNum }));",
        "showSuccess(wasEdit ? t('roomUpdated', { room: roomNum }) : t('roomCreated', { room: roomNum }));",
    )
    s = s.replace("setMsg(tc('error'));", "showApiError({ error: tc('error') });")

    s = s.replace(
        "    <AppShell maxWidthClass=\"max-w-4xl\">\n"
        "      <PageHeader title={t('title')} />\n"
        "      <StatusMessage>{msg}</StatusMessage>\n\n",
        "    <>\n      <PageHeader title={t('title')} />\n\n",
    )
    s = s.replace(
        '<PageSection className="mb-6">',
        "<section className={`${CARD_CONTAINER_CLASS} mb-6 p-4`}>",
    )
    s = s.replace("</PageSection>", "</section>")
    s = s.replace("</AppShell>", "</>")
    s = s.replace("<StatusMessage>{msg}</StatusMessage>\n\n", "")

    s = re.sub(
        r"<RetireFilterSelect value=\{(\w+)\} onChange=\{(\w+)\} labels=\{retireLabels\} />",
        r"<RetireFilterSelect value={\1} onChange={\2} labels={retireLabels} statusLabel={t('activeStatus')} />",
        s,
    )

    def repl_pair(m: re.Match[str]) -> str:
        v, setv, ph, rv, setrv = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
        return (
            '<EraListFilterBar showActions={false} className="mb-3">\n'
            "          <Field\n"
            "            label={tc('search')}\n"
            '            preset="longText"\n'
            f"            value={{{v}}}\n"
            f"            onChange={{(e) => {setv}(e.target.value)}}\n"
            f"            placeholder={{{ph}}}\n"
            "          />\n"
            "          <RetireFilterSelect\n"
            f"            value={{{rv}}}\n"
            f"            onChange={{{setrv}}}\n"
            "            labels={retireLabels}\n"
            "            statusLabel={t('activeStatus')}\n"
            "          />\n"
            "        </EraListFilterBar>"
        )

    s, n = re.subn(
        r"<ListFilterInput value=\{(\w+)\} onChange=\{(\w+)\} placeholder=\{([^}]+)\} />\s*"
        r"<RetireFilterSelect value=\{(\w+)\} onChange=\{(\w+)\} labels=\{retireLabels\} "
        r"statusLabel=\{t\('activeStatus'\)\} />",
        repl_pair,
        s,
    )
    print("pairs", n)

    # Also catch pairs without statusLabel yet
    s, n2 = re.subn(
        r"<ListFilterInput value=\{(\w+)\} onChange=\{(\w+)\} placeholder=\{([^}]+)\} />\s*"
        r"<RetireFilterSelect value=\{(\w+)\} onChange=\{(\w+)\} labels=\{retireLabels\} />",
        repl_pair,
        s,
    )
    print("pairs2", n2)

    old_room = (
        "            <ListFilterInput value={roomFilter} onChange={setRoomFilter} "
        "placeholder={t('filterRoomPlaceholder')} />\n"
        "            <select\n"
        "              className={`${MODAL_INPUT_CLASS} max-w-[160px] text-[13px]`}\n"
        "              value={roomInventoryFilter}\n"
        "              onChange={(e) => setRoomInventoryFilter(e.target.value as RoomInventoryFilter)}\n"
        "            >\n"
        "              <option value=\"ALL\">{t('allRoomInventory')}</option>\n"
        "              <option value=\"INVENTORY\">{t('inInventory')}</option>\n"
        "              <option value=\"DISABLED\">{t('disabledRooms')}</option>\n"
        "              <option value=\"DELETED\">{t('deletedRooms')}</option>\n"
        "            </select>\n"
        "            <select\n"
        "              className={`${MODAL_INPUT_CLASS} max-w-[140px] text-[13px]`}\n"
        "              value={roomTypeFilter}\n"
        "              onChange={(e) => setRoomTypeFilter(e.target.value)}\n"
        "            >\n"
        "              <option value=\"\">{t('allRoomTypes')}</option>\n"
        "              {roomTypes.map((rt) => (\n"
        "                <option key={rt.id} value={rt.id}>\n"
        "                  {rt.code}\n"
        "                </option>\n"
        "              ))}\n"
        "            </select>"
    )
    new_room = (
        '            <EraListFilterBar showActions={false} className="mb-0">\n'
        "              <Field\n"
        "                label={tc('search')}\n"
        '                preset="longText"\n'
        "                value={roomFilter}\n"
        "                onChange={(e) => setRoomFilter(e.target.value)}\n"
        "                placeholder={t('filterRoomPlaceholder')}\n"
        "              />\n"
        "              <FieldSelect\n"
        "                label={t('activeStatus')}\n"
        '                preset="selectWide"\n'
        "                value={roomInventoryFilter}\n"
        "                onChange={(e) => setRoomInventoryFilter(e.target.value as RoomInventoryFilter)}\n"
        "              >\n"
        "                <option value=\"ALL\">{t('allRoomInventory')}</option>\n"
        "                <option value=\"INVENTORY\">{t('inInventory')}</option>\n"
        "                <option value=\"DISABLED\">{t('disabledRooms')}</option>\n"
        "                <option value=\"DELETED\">{t('deletedRooms')}</option>\n"
        "              </FieldSelect>\n"
        "              <FieldSelect\n"
        "                label={t('type')}\n"
        '                preset="select"\n'
        "                value={roomTypeFilter}\n"
        "                onChange={(e) => setRoomTypeFilter(e.target.value)}\n"
        "              >\n"
        "                <option value=\"\">{t('allRoomTypes')}</option>\n"
        "                {roomTypes.map((rt) => (\n"
        "                  <option key={rt.id} value={rt.id}>\n"
        "                    {rt.code}\n"
        "                  </option>\n"
        "                ))}\n"
        "              </FieldSelect>\n"
        "            </EraListFilterBar>"
    )
    print("room block", old_room in s)
    if old_room in s:
        s = s.replace(old_room, new_room)

    # rate-plan filter may already be EraListFilterBar from earlier partial patch
    s = re.sub(
        r"<RetireFilterSelect\s+value=\{rpRetireFilter\}\s+onChange=\{setRpRetireFilter\}\s+"
        r"labels=\{retireLabels\}\s*/>",
        "<RetireFilterSelect value={rpRetireFilter} onChange={setRpRetireFilter} "
        "labels={retireLabels} statusLabel={t('activeStatus')} />",
        s,
    )

    leftovers = {
        "ListFilterInput": "ListFilterInput" in s,
        "AppShell": "AppShell" in s,
        "StatusMessage": "StatusMessage" in s,
        "PageSection": "PageSection" in s,
        "MODAL_INPUT_CLASS": "MODAL_INPUT_CLASS" in s,
        "setMsg": "setMsg" in s,
        "const [msg": "const [msg" in s,
    }
    print("master leftovers", leftovers)
    save(p, s)


def patch_integration() -> None:
    p = ROOT / "integration" / "page.tsx"
    s = load(p)

    old_imp = (
        "import {\n"
        "  DATA_TABLE_CLASS,\n"
        "  DATA_TABLE_HEAD_ROW_CLASS,\n"
        "  DATA_TABLE_TH_LEFT_CLASS,\n"
        "  DATA_TABLE_TR_CLASS,\n"
        "  DATA_TABLE_TD_CLASS,\n"
        "  DATA_TABLE_VIEWPORT_CLASS,\n"
        "  FORM_FIELD_GROUP_CLASS,\n"
        "  FORM_STACK_CLASS,\n"
        "  MODAL_CHECKBOX_CLASS,\n"
        "  MODAL_FIELD_LABEL_CLASS,\n"
        "  MODAL_INPUT_CLASS,\n"
        "  PRIMARY_BUTTON_CLASS,\n"
        "  SECONDARY_BUTTON_CLASS,\n"
        "} from '@era/satellite-kit/ui';\n"
        "import { PageHeader } from '@era/satellite-kit/ui';\n"
        "import { EraModal, EraModalFooter } from '@/components/EraModal';\n"
        "import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';"
    )
    new_imp = (
        "import {\n"
        "  CARD_CONTAINER_CLASS,\n"
        "  DATA_TABLE_CLASS,\n"
        "  DATA_TABLE_HEAD_ROW_CLASS,\n"
        "  DATA_TABLE_TH_LEFT_CLASS,\n"
        "  DATA_TABLE_TR_CLASS,\n"
        "  DATA_TABLE_TD_CLASS,\n"
        "  DATA_TABLE_VIEWPORT_CLASS,\n"
        "  EraListFilterBar,\n"
        "  Field,\n"
        "  FieldSelect,\n"
        "  FORM_STACK_CLASS,\n"
        "  MODAL_CHECKBOX_CLASS,\n"
        "  PRIMARY_BUTTON_CLASS,\n"
        "  SECONDARY_BUTTON_CLASS,\n"
        "  PageHeader,\n"
        "  showApiError,\n"
        "  showSuccess,\n"
        "} from '@era/satellite-kit/ui';\n"
        "import { EraModal, EraModalFooter } from '@/components/EraModal';"
    )
    print("integ import", old_imp in s)
    if old_imp in s:
        s = s.replace(old_imp, new_imp)

    # PosBridge
    s = s.replace(
        "  const [msg, setMsg] = useState<string | null>(null);\n"
        "  const [busy, setBusy] = useState(false);\n"
        "  const formId = 'pos-bridge-form';\n\n"
        "  async function send() {\n"
        "    setBusy(true);\n"
        "    const res = await fetch('/api/pos/room-charge', {\n"
        "      method: 'POST',\n"
        "      headers: { 'Content-Type': 'application/json' },\n"
        "      body: JSON.stringify({\n"
        "        roomNumber,\n"
        "        revenueCode: 'FOOD',\n"
        "        amount: parseFloat(amount),\n"
        "        description: t('posBridgeDescription'),\n"
        "        outletCode: 'RESTAURANT',\n"
        "      }),\n"
        "    });\n"
        "    const data = await res.json();\n"
        "    setBusy(false);\n"
        "    setMsg(res.ok ? t('roomChargePosted') : data.error);\n"
        "    if (res.ok) onClose();\n"
        "  }",
        "  const [busy, setBusy] = useState(false);\n"
        "  const formId = 'pos-bridge-form';\n\n"
        "  async function send() {\n"
        "    setBusy(true);\n"
        "    try {\n"
        "      const res = await fetch('/api/pos/room-charge', {\n"
        "        method: 'POST',\n"
        "        headers: { 'Content-Type': 'application/json' },\n"
        "        body: JSON.stringify({\n"
        "          roomNumber,\n"
        "          revenueCode: 'FOOD',\n"
        "          amount: parseFloat(amount),\n"
        "          description: t('posBridgeDescription'),\n"
        "          outletCode: 'RESTAURANT',\n"
        "        }),\n"
        "      });\n"
        "      const data = await res.json();\n"
        "      setBusy(false);\n"
        "      if (!res.ok) {\n"
        "        showApiError(data, tc('failed'));\n"
        "        return;\n"
        "      }\n"
        "      showSuccess(t('roomChargePosted'));\n"
        "      onClose();\n"
        "    } catch (e) {\n"
        "      setBusy(false);\n"
        "      showApiError({ error: e instanceof Error ? e.message : tc('failed') });\n"
        "    }\n"
        "  }",
    )

    s = s.replace(
        "      <form id={formId} className={FORM_STACK_CLASS} onSubmit={(e) => { e.preventDefault(); void send(); }}>\n"
        "        {msg && <p className=\"text-[13px] text-[#7F8C8D]\">{msg}</p>}\n"
        "        <div className={FORM_FIELD_GROUP_CLASS}>\n"
        "          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor=\"pos-room\">\n"
        "            Room\n"
        "          </label>\n"
        "          <input\n"
        "            id=\"pos-room\"\n"
        "            className={MODAL_INPUT_CLASS}\n"
        "            value={roomNumber}\n"
        "            onChange={(e) => setRoomNumber(e.target.value)}\n"
        "          />\n"
        "        </div>\n"
        "        <div className={FORM_FIELD_GROUP_CLASS}>\n"
        "          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor=\"pos-amount\">\n"
        "            {tc('amount')}\n"
        "          </label>\n"
        "          <input\n"
        "            id=\"pos-amount\"\n"
        "            className={MODAL_INPUT_CLASS}\n"
        "            value={amount}\n"
        "            onChange={(e) => setAmount(e.target.value)}\n"
        "          />\n"
        "        </div>\n"
        "      </form>",
        "      <form id={formId} className={FORM_STACK_CLASS} onSubmit={(e) => { e.preventDefault(); void send(); }}>\n"
        "        <Field label=\"Room\" preset=\"code\" id=\"pos-room\" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />\n"
        "        <Field label={tc('amount')} preset=\"amount\" id=\"pos-amount\" value={amount} onChange={(e) => setAmount(e.target.value)} />\n"
        "      </form>",
    )

    s = s.replace(
        "  const [msg, setMsg] = useState<string | null>(null);\n"
        "  const [busy, setBusy] = useState(false);\n"
        "  const formId = 'e6-simulator-form';\n\n"
        "  async function send(e: React.FormEvent) {\n"
        "    e.preventDefault();\n"
        "    setBusy(true);\n"
        "    setMsg(null);\n"
        "    const res = await fetch('/api/integration/erp/simulate', {\n"
        "      method: 'POST',\n"
        "      headers: { 'Content-Type': 'application/json' },\n"
        "      body: JSON.stringify({\n"
        "        invoiceRef,\n"
        "        fiscalStatus: status,\n"
        "        fiscalExternalId: status === 'accepted' ? `EQ-${Date.now()}` : undefined,\n"
        "        rejectionReason: status === 'rejected' ? t('rejectionDemo') : undefined,\n"
        "      }),\n"
        "    });\n"
        "    const data = await res.json();\n"
        "    setBusy(false);\n"
        "    setMsg(res.ok ? t('e6Applied', { status: data.document?.fiscalStatus }) : data.error ?? tc('failed'));\n"
        "    if (res.ok) {\n"
        "      onDone();\n"
        "      onClose();\n"
        "    }\n"
        "  }",
        "  const [busy, setBusy] = useState(false);\n"
        "  const formId = 'e6-simulator-form';\n\n"
        "  async function send(e: React.FormEvent) {\n"
        "    e.preventDefault();\n"
        "    setBusy(true);\n"
        "    try {\n"
        "      const res = await fetch('/api/integration/erp/simulate', {\n"
        "        method: 'POST',\n"
        "        headers: { 'Content-Type': 'application/json' },\n"
        "        body: JSON.stringify({\n"
        "          invoiceRef,\n"
        "          fiscalStatus: status,\n"
        "          fiscalExternalId: status === 'accepted' ? `EQ-${Date.now()}` : undefined,\n"
        "          rejectionReason: status === 'rejected' ? t('rejectionDemo') : undefined,\n"
        "        }),\n"
        "      });\n"
        "      const data = await res.json();\n"
        "      setBusy(false);\n"
        "      if (!res.ok) {\n"
        "        showApiError(data, tc('failed'));\n"
        "        return;\n"
        "      }\n"
        "      showSuccess(t('e6Applied', { status: data.document?.fiscalStatus }));\n"
        "      onDone();\n"
        "      onClose();\n"
        "    } catch (err) {\n"
        "      setBusy(false);\n"
        "      showApiError({ error: err instanceof Error ? err.message : tc('failed') });\n"
        "    }\n"
        "  }",
    )

    s = s.replace(
        "      <form id={formId} onSubmit={send} className={FORM_STACK_CLASS}>\n"
        "        {msg && <p className=\"text-[13px] text-[#7F8C8D]\">{msg}</p>}\n"
        "        <div className={FORM_FIELD_GROUP_CLASS}>\n"
        "          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor=\"e6-invoice\">\n"
        "            {t('invoiceRefPlaceholder')}\n"
        "          </label>\n"
        "          <input\n"
        "            id=\"e6-invoice\"\n"
        "            placeholder={t('invoiceRefPlaceholder')}\n"
        "            className={MODAL_INPUT_CLASS}\n"
        "            value={invoiceRef}\n"
        "            onChange={(e) => setInvoiceRef(e.target.value)}\n"
        "          />\n"
        "        </div>\n"
        "        <div className={FORM_FIELD_GROUP_CLASS}>\n"
        "          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor=\"e6-status\">\n"
        "            {tc('status')}\n"
        "          </label>\n"
        "          <select id=\"e6-status\" className={MODAL_INPUT_CLASS} value={status} onChange={(e) => setStatus(e.target.value)}>\n"
        "            <option value=\"sent\">{t('fiscalSent')}</option>\n"
        "            <option value=\"accepted\">{t('fiscalAccepted')}</option>\n"
        "            <option value=\"rejected\">{t('fiscalRejected')}</option>\n"
        "          </select>\n"
        "        </div>\n"
        "      </form>",
        "      <form id={formId} onSubmit={send} className={FORM_STACK_CLASS}>\n"
        "        <Field\n"
        "          label={t('invoiceRefPlaceholder')}\n"
        '          preset="code"\n'
        '          id="e6-invoice"\n'
        "          placeholder={t('invoiceRefPlaceholder')}\n"
        "          value={invoiceRef}\n"
        "          onChange={(e) => setInvoiceRef(e.target.value)}\n"
        "        />\n"
        "        <FieldSelect label={tc('status')} preset=\"select\" id=\"e6-status\" value={status} onChange={(e) => setStatus(e.target.value)}>\n"
        "          <option value=\"sent\">{t('fiscalSent')}</option>\n"
        "          <option value=\"accepted\">{t('fiscalAccepted')}</option>\n"
        "          <option value=\"rejected\">{t('fiscalRejected')}</option>\n"
        "        </FieldSelect>\n"
        "      </form>",
    )

    s = s.replace(
        "        <input\n"
        "          className={MODAL_INPUT_CLASS}\n"
        "          value={code}\n"
        "          onChange={(e) => setCode(e.target.value)}\n"
        "        />",
        '        <Field label={tc("code")} preset="code" value={code} onChange={(e) => setCode(e.target.value)} />',
    )
    # fix quotes if double wrong
    s = s.replace(
        '<Field label={tc("code")} preset="code" value={code} onChange={(e) => setCode(e.target.value)} />',
        "<Field label={tc('code')} preset=\"code\" value={code} onChange={(e) => setCode(e.target.value)} />",
    )

    s = s.replace(
        "  const [msg, setMsg] = useState<string | null>(null);\n  const [busy, setBusy] = useState(false);",
        "  const [busy, setBusy] = useState(false);\n"
        "  const [logSearchDraft, setLogSearchDraft] = useState('');\n"
        "  const [logSearchApplied, setLogSearchApplied] = useState('');",
    )
    s = s.replace("    setMsg(null);\n    try {", "    try {")
    s = s.replace("      setMsg(t('settingsSaved'));", "      showSuccess(t('settingsSaved'));")
    s = s.replace(
        "      setMsg(e instanceof Error ? e.message : tc('error'));",
        "      showApiError({ error: e instanceof Error ? e.message : tc('error') });",
    )
    s = s.replace(
        "    setMsg(t('retryQueue', { count: data.sent ?? 0 }));",
        "    showSuccess(t('retryQueue', { count: data.sent ?? 0 }));",
    )
    s = s.replace(
        "    setMsg(res.ok ? t('e5Sent', { id: data.correlationId }) : data.error);",
        "    if (res.ok) showSuccess(t('e5Sent', { id: data.correlationId }));\n"
        "    else showApiError(data, tc('failed'));",
    )
    s = s.replace("      setMsg(data.error ?? tc('updateFailed'));", "      showApiError(data, tc('updateFailed'));")
    s = s.replace("    setMsg(t('glMappingSaved'));", "    showSuccess(t('glMappingSaved'));")

    s = s.replace(
        "  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {\n"
        "    return (\n"
        "      <AppShell maxWidthClass=\"max-w-4xl\">\n"
        "        <p className=\"text-[13px] text-[#7F8C8D]\">{tc('noPermission')}</p>\n"
        "      </AppShell>\n"
        "    );\n"
        "  }\n\n"
        "  if (!settings) {\n"
        "    return (\n"
        "      <AppShell maxWidthClass=\"max-w-4xl\">\n"
        "        <p className=\"text-[13px] text-[#7F8C8D]\">{tc('loading')}</p>\n"
        "      </AppShell>\n"
        "    );\n"
        "  }",
        "  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {\n"
        "    return <p className=\"text-[13px] text-[#7F8C8D]\">{tc('noPermission')}</p>;\n"
        "  }\n\n"
        "  if (!settings) {\n"
        "    return <p className=\"text-[13px] text-[#7F8C8D]\">{tc('loading')}</p>;\n"
        "  }",
    )

    s = s.replace("    <AppShell maxWidthClass=\"max-w-4xl\">", "    <>")
    s = s.replace("      <StatusMessage>{msg}</StatusMessage>\n\n", "")
    s = s.replace(
        '<PageSection className="mb-6 rounded border',
        "<section className={`${CARD_CONTAINER_CLASS} mb-6 rounded border",
    )
    s = s.replace(
        '<PageSection className="mb-6 space-y-3 text-[13px] text-[#34495E]">',
        "<section className={`${CARD_CONTAINER_CLASS} mb-6 space-y-3 p-4 text-[13px] text-[#34495E]`}>",
    )
    s = s.replace(
        '<PageSection className="mb-6">',
        "<section className={`${CARD_CONTAINER_CLASS} mb-6 p-4`}>",
    )
    s = s.replace("<PageSection>", "<section className={`${CARD_CONTAINER_CLASS} p-4`}>")
    s = s.replace("</PageSection>", "</section>")
    s = s.replace("</AppShell>", "</>")

    s = s.replace(
        "        <div className={FORM_FIELD_GROUP_CLASS}>\n"
        "          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor=\"url-default\">\n"
        "            {t('defaultUrl')}\n"
        "          </label>\n"
        "          <input\n"
        "            id=\"url-default\"\n"
        "            className={MODAL_INPUT_CLASS}\n"
        "            value={settings.urls.default}\n"
        "            onChange={(e) =>\n"
        "              setSettings((s) => s && { ...s, urls: { ...s.urls, default: e.target.value } })\n"
        "            }\n"
        "          />\n"
        "        </div>\n"
        "        <div className={FORM_FIELD_GROUP_CLASS}>\n"
        "          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor=\"url-na\">\n"
        "            {t('nightAuditUrl')}\n"
        "          </label>\n"
        "          <input\n"
        "            id=\"url-na\"\n"
        "            className={MODAL_INPUT_CLASS}\n"
        "            value={settings.urls.nightAudit}\n"
        "            onChange={(e) =>\n"
        "              setSettings((s) => s && { ...s, urls: { ...s.urls, nightAudit: e.target.value } })\n"
        "            }\n"
        "          />\n"
        "        </div>",
        "        <Field\n"
        "          label={t('defaultUrl')}\n"
        '          preset="longText"\n'
        '          id="url-default"\n'
        "          value={settings.urls.default}\n"
        "          onChange={(e) =>\n"
        "            setSettings((s) => s && { ...s, urls: { ...s.urls, default: e.target.value } })\n"
        "          }\n"
        "        />\n"
        "        <Field\n"
        "          label={t('nightAuditUrl')}\n"
        '          preset="longText"\n'
        '          id="url-na"\n'
        "          value={settings.urls.nightAudit}\n"
        "          onChange={(e) =>\n"
        "            setSettings((s) => s && { ...s, urls: { ...s.urls, nightAudit: e.target.value } })\n"
        "          }\n"
        "        />",
    )

    if "logSearchDraft" in s and "EraListFilterBar" not in s.split("outboundJournal")[1][:800]:
        pass
    if "outboundJournal" in s and "logSearchDraft" in s and "setLogSearchApplied" not in s.split("outboundJournal")[1][:1200]:
        s = s.replace(
            "        <h2 className=\"mb-3 text-sm font-semibold text-[#34495E]\">{t('outboundJournal')}</h2>\n"
            "        <div className={DATA_TABLE_VIEWPORT_CLASS}>",
            "        <h2 className=\"mb-3 text-sm font-semibold text-[#34495E]\">{t('outboundJournal')}</h2>\n"
            "        <EraListFilterBar\n"
            "          applyLabel={tc('filterApply')}\n"
            "          resetLabel={tc('filterReset')}\n"
            '          className="mb-3"\n'
            "          onApply={() => setLogSearchApplied(logSearchDraft)}\n"
            "          onReset={() => {\n"
            "            setLogSearchDraft('');\n"
            "            setLogSearchApplied('');\n"
            "          }}\n"
            "        >\n"
            "          <Field\n"
            "            label={tc('search')}\n"
            '            preset="longText"\n'
            "            value={logSearchDraft}\n"
            "            onChange={(e) => setLogSearchDraft(e.target.value)}\n"
            "          />\n"
            "        </EraListFilterBar>\n"
            "        <div className={DATA_TABLE_VIEWPORT_CLASS}>",
        )

    if "{logs.map((l) => (" in s and "logSearchApplied" in s:
        s = s.replace(
            "{logs.map((l) => (",
            "{logs\n"
            "              .filter((l) => {\n"
            "                const q = logSearchApplied.trim().toLowerCase();\n"
            "                if (!q) return true;\n"
            "                return (\n"
            "                  l.eventType.toLowerCase().includes(q) ||\n"
            "                  l.status.toLowerCase().includes(q) ||\n"
            "                  (l.lastError ?? '').toLowerCase().includes(q)\n"
            "                );\n"
            "              })\n"
            "              .map((l) => (",
        )

    leftovers = {
        "AppShell": "AppShell" in s,
        "StatusMessage": "StatusMessage" in s,
        "PageSection": "PageSection" in s,
        "MODAL_INPUT_CLASS": "MODAL_INPUT_CLASS" in s,
        "FORM_FIELD_GROUP": "FORM_FIELD_GROUP" in s,
        "setMsg": "setMsg" in s,
        "showApiError": "showApiError" in s,
    }
    print("integ leftovers", leftovers)
    save(p, s)


if __name__ == "__main__":
    patch_master_data()
    patch_integration()
    print("done")
