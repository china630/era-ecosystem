export type NoteFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "number"
  | "date"
  | "bodyMap";

export type L10n = { en: string; ru: string; az: string };

export type NoteTemplateFieldDef = {
  key: string;
  type: NoteFieldType;
  label: L10n;
  required?: boolean;
  options?: string[];
  quickAnswers?: string[];
};

export type NoteTemplateSectionDef = {
  key: string;
  title: L10n;
  fields: NoteTemplateFieldDef[];
};

export type NoteTemplateSectionsDoc = {
  sections: NoteTemplateSectionDef[];
};