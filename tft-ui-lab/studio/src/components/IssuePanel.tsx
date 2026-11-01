import type { LintIssue } from '../lib/lint';

interface Props {
  issues: LintIssue[];
  allIssues: LintIssue[];
  screenId: string;
  onFocus: (issue: LintIssue) => void;
}

export default function IssuePanel({ issues, allIssues, screenId, onFocus }: Props) {
  const screenIssues = issues.filter((i) => i.screen === screenId);
  const shown = screenIssues.length ? screenIssues : allIssues.slice(0, 120);
  const errors = shown.filter((i) => i.severity === 'error').length;
  const warnings = shown.filter((i) => i.severity === 'warning').length;

  return (
    <div className="issues-panel" data-testid="issues-panel">
      <div className={`lint-banner ${errors ? 'bad' : warnings ? 'warn' : 'good'}`}>
        <span className="lint-dot" />
        <strong>{errors ? `${errors} BLOCKING` : warnings ? `${warnings} WARNINGS` : 'LAYOUT CLEAN'}</strong>
        <span>{screenIssues.length ? `on ${screenId}` : 'all screens'}</span>
      </div>
      <p className="panel-note">
        Geometry is measured from the real TFT_eSPI GFX font advance widths, then checked for bounds, text fit,
        content collisions, touch targets and contrast.
      </p>
      <div className="issue-list">
        {shown.map((issue) => (
          <button
            key={issue.id}
            className={`issue-row ${issue.severity}`}
            onClick={() => onFocus(issue)}
            title={issue.message}
          >
            <span className="issue-code">{issue.code}</span>
            <span className="issue-msg">{issue.message}</span>
            <span className="issue-loc mono">
              {issue.screen}
              {issue.widget ? ` / ${issue.widget}` : ''} / {issue.scenario}
            </span>
          </button>
        ))}
        {shown.length === 0 && <div className="clean-state">No geometry defects in this view.</div>}
      </div>
    </div>
  );
}
