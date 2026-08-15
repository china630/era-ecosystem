from pathlib import Path

ROOT = Path(r"d:/My Projects/era-ecosystem/era-hotel-pms")

banquets = ROOT / "app/banquets/page.tsx"
t = banquets.read_text(encoding="utf-8")
old = """import {
  DatePicker,
  EraListFilterBar,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  Field,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
  useCallback,
  useEffect,
  useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
  FORM_FIELD_GROUP_CLASS,
} from '@era/satellite-kit/ui';
"""
new = """import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  EraListFilterBar,
  Field,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
"""
if old not in t:
    raise SystemExit('banquets import block not found')
banquets.write_text(t.replace(old, new), encoding="utf-8", newline="\n")
print("fixed banquets")

channel = ROOT / "app/channel/page.tsx"
t = channel.read_text(encoding="utf-8")
old = """import {
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  EraListFilterBar,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  Field,
  GHOST_BUTTON_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
  showApiError,
  showSuccess,
  useCallback,
  useEffect,
  useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
} from '@era/satellite-kit/ui';
"""
new = """import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  EraListFilterBar,
  Field,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  GHOST_BUTTON_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
"""
if old not in t:
    raise SystemExit('channel import block not found')
channel.write_text(t.replace(old, new), encoding="utf-8", newline="\n")
print("fixed channel")
