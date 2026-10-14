export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] pt-24 px-4" aria-busy="true" aria-label="Loading Daily Spark">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="skeleton h-56 rounded-3xl" />
        <div className="skeleton h-20 rounded-2xl" />
        <div className="skeleton h-20 rounded-2xl" />
      </div>
    </div>
  );
}
