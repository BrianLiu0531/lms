import ReactMarkdown from 'react-markdown';

/** Renders lesson content. react-markdown ignores raw HTML by default, so content can't inject scripts. */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
