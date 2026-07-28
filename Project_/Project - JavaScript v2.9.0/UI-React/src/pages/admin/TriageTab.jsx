import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/PageHeader.jsx';
import TicketList from '../../components/TicketList.jsx';
import TicketDetailModal from '../../components/TicketDetailModal.jsx';
import Banner from '../../components/Banner.jsx';
import SortSelect from '../../components/SortSelect.jsx';
import { isUnprocessed, autoTriageDecision, sortByCreatedAt } from '../../lib/constants.js';

export default function TriageTab({ tickets, api, onChanged }) {
  const [selected, setSelected] = useState(null);
  const [denyNote, setDenyNote] = useState('');
  const [showDenyFor, setShowDenyFor] = useState(null);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [sortOrder, setSortOrder] = useState('oldest');

  const pending = useMemo(
    () => sortByCreatedAt(tickets.filter(isUnprocessed), sortOrder),
    [tickets, sortOrder]
  );

  async function accept(id) {
    try {
      await api.updateTicket(id, { status: 'accepted' });
      setSelected(null);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deny(id, note) {
    try {
      await api.updateTicket(id, { status: 'denied', triageNote: note || 'Denied by admin' });
      setSelected(null);
      setShowDenyFor(null);
      setDenyNote('');
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function runAutoTriage() {
    setRunning(true);
    setSummary(null);
    setError('');
    const denied = [];
    for (const tk of pending) {
      const reason = autoTriageDecision(tk);
      if (!reason) continue;
      try {
        await api.updateTicket(tk.id, { status: 'denied', triageNote: `Auto-denied: ${reason}` });
        denied.push({ title: tk.title, reason });
      } catch {
        // skip failures, continue with the rest of the batch
      }
    }
    setRunning(false);
    setSummary({ checked: pending.length, denied });
    await onChanged();
  }

  return (
    <>
      <PageHeader
        title="Triage"
        subtitle="Review new requests — accept into the support queue, or deny with a note."
        action={
          <button className="btn btn-ghost" onClick={runAutoTriage} disabled={running || pending.length === 0}>
            {running ? 'Running…' : 'Run Auto-Triage'}
          </button>
        }
      />

      {error && <Banner kind="error" onDismiss={() => setError('')}>{error}</Banner>}

      {summary && (
        <Banner kind="info" onDismiss={() => setSummary(null)}>
          {summary.checked === 0
            ? 'Nothing awaiting review right now.'
            : summary.denied.length === 0
            ? `Checked ${summary.checked} pending ticket${summary.checked !== 1 ? 's' : ''} — none matched a denial rule.`
            : `Auto-denied ${summary.denied.length} of ${summary.checked} pending ticket(s): ${summary.denied.map((d) => `"${d.title}" (${d.reason})`).join('; ')}`}
        </Banner>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <SortSelect value={sortOrder} onChange={setSortOrder} />
      </div>

      <TicketList tickets={pending} onSelect={setSelected} emptyLabel="Nothing waiting on triage." showRequester />

      {selected && (
        <TicketDetailModal
          ticket={selected}
          onClose={() => setSelected(null)}
          actions={[
            { label: 'Accept', onClick: () => accept(selected.id), variant: 'primary' },
            { label: 'Deny…', onClick: () => setShowDenyFor(selected.id), variant: 'danger' },
          ]}
        />
      )}

      {showDenyFor && (
        <div className="modal-backdrop" style={{ zIndex: 130 }} onMouseDown={(e) => e.target === e.currentTarget && setShowDenyFor(null)}>
          <div className="modal-panel" style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3>Deny request</h3>
              <button className="modal-close" onClick={() => setShowDenyFor(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                <label>Triage note (optional)</label>
                <textarea value={denyNote} onChange={(e) => setDenyNote(e.target.value)} placeholder="Explain why this request is being denied…" />
              </div>
              <button className="btn btn-danger" onClick={() => deny(showDenyFor, denyNote)}>Confirm deny</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
