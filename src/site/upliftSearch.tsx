import { SearchField, type SearchFieldProps } from "@/components/arc/search-field/search-field";

/** Genuine UIARC search, composed inside the existing Leander layout.
 * The label stays available to assistive technology; existing visible copy is unchanged.
 */
export function UpliftSearch(props: SearchFieldProps) {
  return <div className="uplift-search"><SearchField {...props} /></div>;
}
