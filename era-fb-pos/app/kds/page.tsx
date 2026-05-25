import FbPosNav from "@/components/FbPosNav";
import KdsPanel from "@/components/KdsPanel";

export default function KdsPage() {
  return (
    <>
      <FbPosNav />
      <h1 className="mb-4 text-xl font-semibold">Kitchen display</h1>
      <KdsPanel />
    </>
  );
}
