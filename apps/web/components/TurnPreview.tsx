"use client";

import { useState } from "react";
import styles from "./TurnPreview.module.css";

/** Illustrates the normal replacement path: parallel user check and drafting, then reply check and policy. */
export function TurnPreview() {
  const [play, setPlay] = useState(0);
  return (
    <figure className={styles.scene} aria-labelledby="preview-caption">
      <figcaption id="preview-caption" className={styles.caption}>
        <span><span className={styles.captionDot} aria-hidden="true" /> Two checks. One delivered reply.</span>
        <span className={styles.illustrative}>Illustrative example</span>
      </figcaption>
      <div key={play}>
        <div className={styles.message}>
          <span className={styles.eyebrow}>User message</span>
          <p>“Everything feels pointless lately.”</p>
        </div>

        <div className={styles.parallelLabel}><span>01</span> At the same time</div>
        <div className={styles.split} aria-hidden="true"><i /><i /></div>
        <div className={styles.parallel}>
          <section className={`${styles.lane} ${styles.draft}`} aria-labelledby="companion-lane">
            <div className={styles.laneLabel}>Companion</div>
            <h2 id="companion-lane">Writes a draft</h2>
            <div className={`${styles.activity} ${styles.drafting}`} aria-hidden="true"><span /></div>
            <blockquote>“That sounds really hard. Do you want to tell me more about your day?”</blockquote>
            <span className={styles.held}><span aria-hidden="true">Ⅱ</span> Held before delivery</span>
          </section>
          <section className={`${styles.lane} ${styles.userCheck}`} aria-labelledby="jev-lane">
            <div className={styles.laneLabel}>Jev · in the background</div>
            <h2 id="jev-lane">Reads the user</h2>
            <div className={`${styles.activity} ${styles.reading}`} aria-hidden="true"><span /></div>
            <p>Checks the message and recent context while the companion writes.</p>
            <span className={styles.risk}>Elevated risk</span>
          </section>
        </div>

        <div className={styles.nextStage}>
          <span className={styles.draftConnector} aria-hidden="true">↓</span>
          <span><b>02</b> Once the draft is ready</span>
          <span className={styles.riskConnector} aria-hidden="true" />
        </div>
        <section className={styles.checkpoint} aria-labelledby="reply-check-heading">
          <div className={styles.checkpointGlow} aria-hidden="true" />
          <div className={styles.replyCheck}>
            <div>
              <h2 id="reply-check-heading">Jev checks the draft</h2>
              <p>Support resources missing</p>
            </div>
            <span className={styles.checkTag}>Reply check</span>
          </div>
          <div className={styles.policy}>
            <div><h3>FirstRead policy</h3><p>Elevated risk + missing support → replace the draft.</p></div>
            <span className={styles.replace}>Replace <span aria-hidden="true">↗</span></span>
          </div>
        </section>
        <div className={styles.deliveryConnector} aria-hidden="true">↓</div>
        <section className={styles.delivered} aria-labelledby="delivered-heading">
          <div className={styles.cardHeading}>
            <h2 id="delivered-heading"><span className={styles.stepNumber}>03</span> Delivered reply</h2>
            <span className={styles.sent}><span aria-hidden="true">✓</span> Sent</span>
          </div>
          <blockquote>“I’m really glad you told me this, and I want to make sure you get the right support.”</blockquote>
          <div className={styles.resources}><span aria-hidden="true">＋</span> Local crisis support contacts</div>
          <span className={styles.excerpt}>Replacement excerpt</span>
        </section>
      </div>
      <div className={styles.sceneFooter}>
        <span>Only the final reply reaches the user.</span>
        <button type="button" onClick={() => setPlay((value) => value + 1)} aria-label="Replay intervention animation">
          <span aria-hidden="true">↻</span> Replay
        </button>
      </div>
    </figure>
  );
}
