import { FIELD_LIMITS } from '../../../../shared/fieldLimits';
import type { UpdateChangeOrderPayload } from '../../../services/projects';

/**
 * The PATCH for an edited change order. The server keeps an omitted
 * description, so an unchanged one stays out: a description the server wrote
 * itself ("T&M TM-000123: …", converting a ticket) is often over the 50 it
 * takes from a client, and resending it refused an edit of the amount alone.
 * A changed description must fit.
 */
export function changeOrderEdit(
  original: { description: string },
  values: { description: string; amountCents: number; number: string | null },
): { payload: UpdateChangeOrderPayload } | { tooLong: number } {
  const description = values.description.trim();
  const payload: UpdateChangeOrderPayload = { amountCents: values.amountCents, number: values.number };
  if (description !== original.description.trim()) {
    if (description.length > FIELD_LIMITS.NOTE) return { tooLong: FIELD_LIMITS.NOTE };
    payload.description = description;
  }
  return { payload };
}
