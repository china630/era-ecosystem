import { PageHeader, CARD_CONTAINER_CLASS } from '@era/satellite-kit/ui';

type Props = {
  title: string;
  subtitle?: string;
  moduleKey: string;
  children?: React.ReactNode;
};

/** Standard module screen shell for hotel parity routes. */
export function HotelModuleScreen({ title, subtitle, moduleKey, children }: Props) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle ?? `Module: ${moduleKey}`} />
      <div className={`${CARD_CONTAINER_CLASS} p-6`}>
        {children ?? (
          <p className="text-[13px] text-[#7F8C8D]">
            Operational screen — data grid and actions follow DESIGN.md modal CRUD pattern.
          </p>
        )}
      </div>
    </>
  );
}
