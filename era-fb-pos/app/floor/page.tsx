import FbPosNav from "@/components/FbPosNav";
import FloorPanel from "@/components/FloorPanel";

export default function FloorPage() {
  return (
    <>
      <FbPosNav />
      <h1 className="mb-4 text-xl font-semibold">Floor map</h1>
      <FloorPanel />
    </>
  );
}
