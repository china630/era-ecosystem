#!/usr/bin/env python3
"""
Склеивает скриншоты из подпапок doc/Elektraweb в PDF по модулям.

Каждый PDF: подпись (имя файла) + изображение на отдельной странице.
Выход: doc/Elektraweb/POS.pdf, SPA.pdf и т.д.

Зависимости:
  pip install pillow reportlab

Запуск:
  python scripts/build-elektraweb-pdfs.py
  python scripts/build-elektraweb-pdfs.py --module "14 POS"
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
except ImportError:
    print(
        "Missing dependencies. Install with:\n"
        "  pip install pillow reportlab",
        file=sys.stderr,
    )
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
ELEKTRAWEB_DIR = ROOT / "doc" / "Elektraweb"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"}

MARGIN_X = 15 * mm
MARGIN_TOP = 15 * mm
CAPTION_HEIGHT = 10 * mm
CAPTION_GAP = 3 * mm
BOTTOM_MARGIN = 15 * mm


def folder_to_pdf_name(folder_name: str) -> str:
    """'14 POS' -> 'POS.pdf', '12 STOCK INVENTORY' -> 'STOCK INVENTORY.pdf'."""
    match = re.match(r"^\d+\s+(.+)$", folder_name.strip())
    label = match.group(1) if match else folder_name.strip()
    return f"{label}.pdf"


def natural_sort_key(path: Path) -> list:
    parts = re.split(r"(\d+)", path.name.lower())
    return [int(part) if part.isdigit() else part for part in parts]


def collect_images(folder: Path) -> list[Path]:
    images = [
        path
        for path in folder.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    ]
    return sorted(images, key=natural_sort_key)


def fit_image_size(
    image_width: float,
    image_height: float,
    max_width: float,
    max_height: float,
) -> tuple[float, float]:
    scale = min(max_width / image_width, max_height / image_height, 1.0)
    return image_width * scale, image_height * scale


def build_pdf(images: list[Path], output_path: Path) -> None:
    page_width, page_height = A4
    pdf = canvas.Canvas(str(output_path), pagesize=A4)

    for image_path in images:
        with Image.open(image_path) as img:
            img = ImageOps.exif_transpose(img)
            img_width, img_height = img.size

        caption = image_path.name
        caption_y = page_height - MARGIN_TOP - CAPTION_HEIGHT

        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(MARGIN_X, caption_y, caption)

        available_width = page_width - (2 * MARGIN_X)
        available_height = (
            page_height
            - MARGIN_TOP
            - CAPTION_HEIGHT
            - CAPTION_GAP
            - BOTTOM_MARGIN
        )

        draw_width, draw_height = fit_image_size(
            img_width,
            img_height,
            available_width,
            available_height,
        )

        x = MARGIN_X + (available_width - draw_width) / 2
        y = BOTTOM_MARGIN + (available_height - draw_height) / 2

        pdf.drawImage(
            str(image_path),
            x,
            y,
            width=draw_width,
            height=draw_height,
            preserveAspectRatio=True,
            anchor="sw",
        )
        pdf.showPage()

    pdf.save()


def process_folder(folder: Path, output_dir: Path, dry_run: bool = False) -> bool:
    images = collect_images(folder)
    if not images:
        print(f"  skip {folder.name}: no images")
        return False

    output_path = output_dir / folder_to_pdf_name(folder.name)
    print(f"  {folder.name}: {len(images)} images -> {output_path.name}")

    if dry_run:
        return True

    build_pdf(images, output_path)
    return True


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build module PDFs from Elektraweb screenshot folders.",
    )
    parser.add_argument(
        "--module",
        help='Process only one subfolder, e.g. "14 POS" or "17 SPA".',
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List actions without writing PDF files.",
    )
    args = parser.parse_args()

    if not ELEKTRAWEB_DIR.is_dir():
        print(f"Folder not found: {ELEKTRAWEB_DIR}", file=sys.stderr)
        return 1

    if args.module:
        folders = [ELEKTRAWEB_DIR / args.module]
        if not folders[0].is_dir():
            print(f"Module folder not found: {folders[0]}", file=sys.stderr)
            return 1
    else:
        folders = sorted(
            [path for path in ELEKTRAWEB_DIR.iterdir() if path.is_dir()],
            key=lambda path: natural_sort_key(path),
        )

    print(f"Source: {ELEKTRAWEB_DIR}")
    print(f"Output: {ELEKTRAWEB_DIR}")
    print()

    created = 0
    for folder in folders:
        if process_folder(folder, ELEKTRAWEB_DIR, dry_run=args.dry_run):
            created += 1

    print()
    print(f"Done: {created} PDF(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
