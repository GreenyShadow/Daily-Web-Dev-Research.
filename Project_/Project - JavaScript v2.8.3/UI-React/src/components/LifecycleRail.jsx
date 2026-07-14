import { LIFECYCLE_STEPS, STATUS_META } from '../lib/constants.js';
import './LifecycleRail.css';

// Signature element: a horizontal rail showing where a ticket sits in its
// lifecycle. Denied branches off after "pending" rather than continuing
// the main line, since it's an exit, not a stage.
export default function LifecycleRail({ status }) {
  if (status === 'denied') {
    return (
      <div className="rail rail-denied">
        <div className="rail-step is-done">
          <span className="rail-dot" />
          <span className="rail-label">Pending</span>
        </div>
        <div className="rail-branch">
          <span className="rail-branch-line" />
          <div className="rail-step is-denied">
            <span className="rail-dot" />
            <span className="rail-label">Denied</span>
          </div>
        </div>
      </div>
    );
  }

  const currentIndex = LIFECYCLE_STEPS.indexOf(status);

  return (
    <div className="rail">
      {LIFECYCLE_STEPS.map((step, i) => {
        const meta = STATUS_META[step];
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div className="rail-step-wrap" key={step}>
            <div
              className={`rail-step ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}
              style={isCurrent ? { color: meta.fg } : undefined}
            >
              <span className="rail-dot" />
              <span className="rail-label">{meta.label}</span>
            </div>
            {i < LIFECYCLE_STEPS.length - 1 && <span className="rail-line" />}
          </div>
        );
      })}
    </div>
  );
}
