import { PDFCheckBox, PDFDocument, PDFTextField } from 'pdf-lib';
import { formatAddress, type Answers } from '../answers';
import { formatDate, type StatementContext } from '../statements';

/**
 * Flat values for filling an official fillable PDF. Keys are what a state's
 * YAML `template.fields` maps onto AcroForm field names.
 */
export function templateValues(a: Answers, ctx: StatementContext): Record<string, string> {
  const { t } = ctx;
  const statement = (group: string, value?: string) =>
    value ? t(`statements.${group}.${value}`) : '';
  return {
    'principal.name': a.name ?? '',
    'principal.birthDate': formatDate(a.birthDate, 'en'),
    'principal.address': formatAddress(a.address),
    'principal.phone': a.phone ?? '',
    'agent.name': a.agent?.name ?? '',
    'agent.relationship': a.agent?.relationship ? t(`relationship.${a.agent.relationship}`) : '',
    'agent.phone': a.agent?.phone ?? '',
    'agent.email': a.agent?.email ?? '',
    'agent.address': a.agent?.address ?? '',
    'alternate.name': a.alternate?.name ?? '',
    'alternate.phone': a.alternate?.phone ?? '',
    'alternate.address': a.alternate?.address ?? '',
    'authority.lifeSustaining': a.agentAuthority === 'yes' ? 'true' : '',
    'treatment.terminal': statement('treatment', a.terminal),
    'treatment.unconscious': statement('treatment', a.unconscious),
    'treatment.advancedIllness': statement('treatment', a.advancedIllness),
    'treatment.comfortOnly': a.terminal === 'comfort' ? 'true' : '',
    'treatment.prolong': a.terminal === 'prolong' ? 'true' : '',
    'treatment.nutrition': statement('nutrition', a.nutrition),
    'treatment.cpr': statement('cpr', a.cpr),
    'treatment.pain': statement('pain', a.pain),
    'organ.any': a.organ === 'any' ? 'true' : '',
    'organ.none': a.organ === 'none' ? 'true' : '',
    'organ.detail': a.organ === 'specific' ? (a.organDetail ?? '') : '',
    'physician.name': a.physician?.name ?? '',
    'physician.phone': a.physician?.phone ?? '',
    other: [a.valuesNote, a.spiritual, a.other].filter((s) => s?.trim()).join('\n\n'),
  };
}

export interface FillReport {
  filled: string[];
  missing: string[];
}

/**
 * Fills an AcroForm PDF. `mapping` maps Carewish keys to the template's field
 * names. Text fields receive text; check boxes are checked when the value is
 * "true". Fields that don't exist in the template are reported, not thrown.
 */
export async function fillTemplate(
  template: Uint8Array,
  mapping: Record<string, string>,
  values: Record<string, string>,
  report?: FillReport,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(template);
  const form = doc.getForm();
  const byName = new Map(form.getFields().map((f) => [f.getName(), f]));
  for (const [key, fieldName] of Object.entries(mapping)) {
    const field = byName.get(fieldName);
    const value = values[key] ?? '';
    if (!field) {
      report?.missing.push(fieldName);
      continue;
    }
    if (field instanceof PDFTextField) {
      field.setText(value);
    } else if (field instanceof PDFCheckBox) {
      if (value === 'true') field.check();
      else field.uncheck();
    } else {
      report?.missing.push(fieldName);
      continue;
    }
    report?.filled.push(fieldName);
  }
  return doc.save();
}
