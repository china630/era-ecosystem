from pathlib import Path
import re

ROOT = Path(r"d:/My Projects/era-ecosystem/era-hotel-pms")
p = ROOT / "app/banquets/[id]/page.tsx"
text = p.read_text(encoding="utf-8")

# Ensure DatePicker import
if "DatePicker" not in text:
    text = text.replace(
        "  CARD_CONTAINER_CLASS,\n  Field,",
        "  CARD_CONTAINER_CLASS,\n  DatePicker,\n  Field,",
    )

# Replace state vars
text = text.replace(
    "  const [resourceStart, setResourceStart] = useState('');\n  const [resourceEnd, setResourceEnd] = useState('');",
    "  const [resourceStartDate, setResourceStartDate] = useState('');\n"
    "  const [resourceStartTime, setResourceStartTime] = useState('10:00');\n"
    "  const [resourceEndDate, setResourceEndDate] = useState('');\n"
    "  const [resourceEndTime, setResourceEndTime] = useState('12:00');",
)

text = text.replace(
    "    if (!resourceStart || !resourceEnd) {\n      showApiError({ error: t('resourceMissingTimes') });\n      return;\n    }",
    "    if (!resourceStartDate || !resourceStartTime || !resourceEndDate || !resourceEndTime) {\n"
    "      showApiError({ error: t('resourceMissingTimes') });\n"
    "      return;\n"
    "    }",
)

text = text.replace(
    "        startAt: new Date(resourceStart).toISOString(),\n        endAt: new Date(resourceEnd).toISOString(),",
    "        startAt: new Date(`${resourceStartDate}T${resourceStartTime}`).toISOString(),\n"
    "        endAt: new Date(`${resourceEndDate}T${resourceEndTime}`).toISOString(),",
)

old_fields = '''              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={t('resourceStart')}
                  preset="time"
                  type="datetime-local"
                  value={resourceStart}
                  onChange={(e) => setResourceStart(e.target.value)}
                  required
                />
                <Field
                  label={t('resourceEnd')}
                  preset="time"
                  type="datetime-local"
                  value={resourceEnd}
                  onChange={(e) => setResourceEnd(e.target.value)}
                  required
                />
              </div>'''

new_fields = '''              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  label={t('resourceStart')}
                  value={resourceStartDate}
                  onChange={setResourceStartDate}
                  placeholder={tc('datePlaceholder')}
                  openCalendarLabel={tc('openCalendar')}
                  required
                />
                <Field
                  label={tc('time')}
                  preset="time"
                  type="time"
                  value={resourceStartTime}
                  onChange={(e) => setResourceStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  label={t('resourceEnd')}
                  value={resourceEndDate}
                  onChange={setResourceEndDate}
                  placeholder={tc('datePlaceholder')}
                  openCalendarLabel={tc('openCalendar')}
                  required
                />
                <Field
                  label={tc('time')}
                  preset="time"
                  type="time"
                  value={resourceEndTime}
                  onChange={(e) => setResourceEndTime(e.target.value)}
                  required
                />
              </div>'''

if old_fields not in text:
    raise SystemExit('resource fields block not found')
text = text.replace(old_fields, new_fields)

p.write_text(text, encoding="utf-8", newline="\n")
print("banquets detail patched", "datetime-local left", text.count("datetime-local"))
