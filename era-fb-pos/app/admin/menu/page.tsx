import FbPosNav from "@/components/FbPosNav";
import MenuAdminPanel from "@/components/MenuAdminPanel";

export default function MenuAdminPage() {
  return (
    <>
      <FbPosNav />
      <h1 className="mb-4 text-xl font-semibold">Menu admin</h1>
      <MenuAdminPanel />
    </>
  );
}
