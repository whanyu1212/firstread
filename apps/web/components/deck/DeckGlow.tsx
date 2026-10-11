import styles from "./DeckStyles.module.css";

/** A quiet paper ground; motion belongs to the explanation, not the page. */
export function DeckGlow() {
  return <div className={styles.backdrop} aria-hidden="true" />;
}
