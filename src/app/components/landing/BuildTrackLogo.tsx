/**
 * The BuildTrack wordmark: a white hard hat on an orange squircle, followed by
 * "Build" + "Track" in Quicksand 700.
 *
 * One component so the mark is byte-identical everywhere it appears — the
 * landing nav and footer, and the Docs / Status topbars. Sizes come from the
 * design: 32px box on the landing, 28px on the sub-page topbars, 17px inside
 * the dashboard sheet mock.
 */

type Props = {
  /** Edge length of the orange squircle, in px. The glyph scales with it. */
  boxPx?: number;
  /** Wordmark size, in px. */
  textPx?: number;
  /** Wordmark colour: bone on dark backgrounds, ink on light ones. */
  tone?: 'on-dark' | 'on-light';
  className?: string;
};

export function BuildTrackLogo({
  boxPx = 32,
  textPx = 20,
  tone = 'on-dark',
  className = '',
}: Props) {
  return (
    <span className={`inline-flex items-center gap-[0.34em] ${className}`}>
      <span
        aria-hidden="true"
        className="flex flex-none items-center justify-center bg-bt-orange"
        style={{ width: boxPx, height: boxPx, borderRadius: '22%' }}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{ width: boxPx * 0.625, height: boxPx * 0.625 }}
        >
          {/* knob, dome, brim */}
          <rect x="10.6" y="4.6" width="2.8" height="4.5" rx="1.4" fill="#FFFFFF" />
          <path d="M4.5 15.4 v-1.6 a7.5 7.5 0 0 1 15 0 v1.6 z" fill="#FFFFFF" />
          <rect x="2.8" y="16" width="18.4" height="2.9" rx="1.45" fill="#FFFFFF" />
        </svg>
      </span>
      <span
        className={`font-bt-wordmark font-bold tracking-[-0.005em] ${
          tone === 'on-dark' ? 'text-bt-bone' : 'text-bt-ink'
        }`}
        style={{ fontSize: textPx }}
      >
        Build<span className="text-bt-orange">Track</span>
      </span>
    </span>
  );
}
