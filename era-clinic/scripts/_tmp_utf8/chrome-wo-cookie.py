"""Extract WebOnly cookies from Chrome Profile 7. Prints Cookie header to stdout only."""
from __future__ import annotations

import base64
import json
import os
import shutil
import sqlite3
import tempfile
from ctypes import (
    POINTER,
    Structure,
    byref,
    c_char,
    c_uint,
    c_void_p,
    c_wchar_p,
    create_string_buffer,
    string_at,
    windll,
)
from pathlib import Path

from Crypto.Cipher import AES

LOCALAPPDATA = os.environ["LOCALAPPDATA"]
USER_DATA = Path(LOCALAPPDATA) / "Google/Chrome/User Data"
PROFILE = USER_DATA / "Profile 7"


class DATA_BLOB(Structure):
    _fields_ = [("cbData", c_uint), ("pbData", POINTER(c_char))]


def dpapi_decrypt(blob: bytes) -> bytes:
    in_blob = DATA_BLOB(len(blob), create_string_buffer(blob, len(blob)))
    out_blob = DATA_BLOB()
    if not windll.crypt32.CryptUnprotectData(
        byref(in_blob), c_wchar_p(), None, None, None, 0, byref(out_blob)
    ):
        raise RuntimeError("CryptUnprotectData failed")
    data = string_at(out_blob.pbData, out_blob.cbData)
    windll.kernel32.LocalFree(out_blob.pbData)
    return data


def chrome_key() -> bytes:
    state = json.loads((USER_DATA / "Local State").read_text(encoding="utf-8"))
    enc = base64.b64decode(state["os_crypt"]["encrypted_key"])
    if enc.startswith(b"DPAPI"):
        enc = enc[5:]
    return dpapi_decrypt(enc)


def decrypt_value(key: bytes, value: bytes) -> str:
    if not value:
        return ""
    if value.startswith(b"v10") or value.startswith(b"v20"):
        iv = value[3:15]
        payload = value[15:]
        cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
        # last 16 bytes tag
        plain = cipher.decrypt_and_verify(payload[:-16], payload[-16:])
        return plain.decode("utf-8", "replace")
    try:
        return dpapi_decrypt(value).decode("utf-8", "replace")
    except Exception:
        return ""


def main() -> None:
    src = PROFILE / "Network" / "Cookies"
    tmp = Path(tempfile.gettempdir()) / "chrome-cookies-profile7.db"
    db_path = src
    try:
        shutil.copy2(src, tmp)
        db_path = tmp
    except OSError:
        db_path = src
    key = chrome_key()
    posix = db_path.resolve().as_posix()
    if posix[1:3] == ":/":
        posix = "/" + posix
    uri = "file://" + posix + "?mode=ro&immutable=1"
    con = sqlite3.connect(uri, uri=True)
    con.text_factory = bytes
    cur = con.cursor()
    cur.execute(
        "SELECT host_key, name, encrypted_value FROM cookies WHERE host_key LIKE ?",
        (b"%webonly%",),
    )
    parts: dict[str, str] = {}
    for host, name, enc in cur.fetchall():
        host_s = host.decode("utf-8", "replace") if isinstance(host, bytes) else str(host)
        name_s = name.decode("utf-8", "replace") if isinstance(name, bytes) else str(name)
        val = decrypt_value(key, enc or b"")
        if val:
            parts[name_s] = val
    con.close()
    try:
        tmp.unlink()
    except OSError:
        pass
    if not parts:
        raise SystemExit("no webonly cookies in Chrome Profile 7")
    print("; ".join(f"{k}={v}" for k, v in parts.items()))


if __name__ == "__main__":
    main()
