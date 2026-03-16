import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { level, id, organizationId } = await req.json();
    // level: 'folder' | 'section' | 'object'

    const zip = new JSZip();
    let archiveName = "archive";

    if (level === "folder") {
      // Download all files in a folder
      const { data: folder } = await supabase
        .from("material_folders").select("name").eq("id", id).single();
      archiveName = folder?.name || "folder";

      const { data: files } = await supabase
        .from("material_statements").select("file_name, file_url")
        .eq("folder_id", id).eq("organization_id", organizationId);

      for (const file of files || []) {
        try {
          const resp = await fetch(file.file_url);
          if (resp.ok) {
            const buf = await resp.arrayBuffer();
            zip.file(file.file_name, buf);
          }
        } catch { /* skip failed downloads */ }
      }
    } else if (level === "section") {
      // Download all files in a section with folder structure
      const { data: section } = await supabase
        .from("material_sections").select("name").eq("id", id).single();
      archiveName = section?.name || "section";

      const { data: folders } = await supabase
        .from("material_folders").select("id, name")
        .eq("section_id", id).eq("organization_id", organizationId)
        .order("sort_order");

      for (const folder of folders || []) {
        const { data: files } = await supabase
          .from("material_statements").select("file_name, file_url")
          .eq("folder_id", folder.id).eq("organization_id", organizationId);

        const folderZip = zip.folder(folder.name)!;
        for (const file of files || []) {
          try {
            const resp = await fetch(file.file_url);
            if (resp.ok) {
              const buf = await resp.arrayBuffer();
              folderZip.file(file.file_name, buf);
            }
          } catch { /* skip */ }
        }
      }
    } else if (level === "object") {
      // Download all sections with their folders
      const { data: obj } = await supabase
        .from("material_objects").select("name").eq("id", id).single();
      archiveName = obj?.name || "object";

      const { data: sections } = await supabase
        .from("material_sections").select("id, name")
        .eq("object_id", id).eq("organization_id", organizationId)
        .order("sort_order");

      for (const section of sections || []) {
        const sectionZip = zip.folder(section.name)!;
        const { data: folders } = await supabase
          .from("material_folders").select("id, name")
          .eq("section_id", section.id).eq("organization_id", organizationId)
          .order("sort_order");

        for (const folder of folders || []) {
          const folderZip = sectionZip.folder(folder.name)!;
          const { data: files } = await supabase
            .from("material_statements").select("file_name, file_url")
            .eq("folder_id", folder.id).eq("organization_id", organizationId);

          for (const file of files || []) {
            try {
              const resp = await fetch(file.file_url);
              if (resp.ok) {
                const buf = await resp.arrayBuffer();
                folderZip.file(file.file_name, buf);
              }
            } catch { /* skip */ }
          }
        }
      }
    }

    const zipBlob = await zip.generateAsync({ type: "uint8array" });

    return new Response(zipBlob, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(archiveName)}.zip"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
