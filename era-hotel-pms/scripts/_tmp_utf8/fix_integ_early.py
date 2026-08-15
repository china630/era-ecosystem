import pathlib

p = pathlib.Path(r"d:/My Projects/era-ecosystem/era-hotel-pms/app/admin/integration/page.tsx")
s = p.read_text(encoding="utf-8").replace("\r\n", "\n")
s = s.replace(
    "  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {\n"
    "    return (\n"
    "      <>\n"
    "        <p className=\"text-[13px] text-[#7F8C8D]\">{tc('noPermission')}</p>\n"
    "      </>\n"
    "    );\n"
    "  }\n\n"
    "  if (!settings) {\n"
    "    return (\n"
    "      <>\n"
    "        <p className=\"text-[13px] text-[#7F8C8D]\">{tc('loading')}</p>\n"
    "      </>\n"
    "    );\n"
    "  }",
    "  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {\n"
    "    return <p className=\"text-[13px] text-[#7F8C8D]\">{tc('noPermission')}</p>;\n"
    "  }\n\n"
    "  if (!settings) {\n"
    "    return <p className=\"text-[13px] text-[#7F8C8D]\">{tc('loading')}</p>;\n"
    "  }",
)
p.write_text(s, encoding="utf-8", newline="\n")
print("ok")
