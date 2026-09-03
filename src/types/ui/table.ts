/**
 * A column of `ResponsiveTable`. `label` is already translated — the table
 * renders it in the desktop header row and as the field label of the mobile
 * card, so it has to read as a noun on its own.
 */
export interface DataColumn {
  /** Identifies the column and names its cell slot (`#cell:<key>`). */
  key: string;
  /** Translated column heading / mobile field label. */
  label: string;
  /** Extra classes for the desktop `<th>` — widths and alignment live here. */
  headerClass?: string;
  /** Extra classes for the desktop `<td>`. */
  cellClass?: string;
  /**
   * Renders as the card's headline on mobile instead of a label/value row.
   * At most one column should set it; the first one wins.
   */
  primary?: boolean;
  /**
   * Dropped from the mobile card but kept in the desktop table — for columns
   * that only earn their space on a wide screen (ids, secondary timestamps).
   */
  mobileHidden?: boolean;
}
