export function PageHeading({ title }: { title: string }) {
  return (
    <div className="px-4 pt-8 pb-6">
      <h1 className="text-2xl font-semibold text-foreground sm:text-4xl">{title}</h1>
    </div>
  );
}
