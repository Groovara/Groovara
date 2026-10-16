"use client";

type Props = {
  kind?: "error" | "info";
  title?: string;
  message: string;
};

export default function InlineNotice({ kind = "info", title, message }: Props) {
  const base =
    "rounded-xl border px-4 py-3 text-sm backdrop-blur-md";
  const styles =
    kind === "error"
      ? "border-gv-cherry/25 bg-gv-cherry/10 text-gv-cherry dark:border-gv-cherry/20 dark:text-gv-cream"
      : "border-border bg-card/70 text-muted-foreground";

  return (
    <div className={`${base} ${styles}`}>
      {title && <div className="mb-1 font-medium text-foreground">{title}</div>}
      <div>{message}</div>
    </div>
  );
}
