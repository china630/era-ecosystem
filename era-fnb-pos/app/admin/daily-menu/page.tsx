import FbPosNav from "@/components/FbPosNav";
import DailyMenuAdminPanel from "@/components/DailyMenuAdminPanel";

export default function DailyMenuAdminPage() {
  return (
    <>
      <FbPosNav />
      <h1 className="mb-4 text-xl font-semibold">Daily menu board</h1>
      <DailyMenuAdminPanel />
    </>
  );
}
