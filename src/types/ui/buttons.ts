import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

/**
 * Behavioral props shared by every TDButton preset (PrimaryButton, …).
 * Colors are owned by the preset; everything else passes through to TDButton.
 */
export interface ButtonPresetProps {
  labelText: string;
  faIcon?: IconDefinition;
  disabled?: boolean;
  iconRight?: boolean;
  onClick?: (param?: string) => void;
  onClickParam?: string;
  holdOffsetSec?: number;
  /** `submit` participates in the surrounding form (Enter key included). */
  type?: 'button' | 'submit';
  /** Shows a spinner in place of the icon and disables the button. */
  loading?: boolean;
  fullWidth?: boolean;
  /** Id of the element that explains the button — e.g. why it is disabled. */
  describedBy?: string;
}
