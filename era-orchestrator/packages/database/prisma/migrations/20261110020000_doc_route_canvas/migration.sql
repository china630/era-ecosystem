-- CP-DOC-01 cycle 3: display layout and a single chain of edges.

ALTER TABLE "doc_route_steps" ADD COLUMN "layout_x" INTEGER;
ALTER TABLE "doc_route_steps" ADD COLUMN "layout_y" INTEGER;

CREATE TABLE "doc_route_edges" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "template_id" UUID NOT NULL,
    "from_step_order" INTEGER,
    "to_step_order" INTEGER NOT NULL,
    CONSTRAINT "doc_route_edges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "doc_route_edges_template_id_idx" ON "doc_route_edges"("template_id");

ALTER TABLE "doc_route_edges" ADD CONSTRAINT "doc_route_edges_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "doc_route_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
