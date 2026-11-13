-- 10 — seed the existing HALA.S catalogue so the storefront is not empty on a
-- fresh Supabase project. Runs only when the products table is still empty.

do $$
declare
  v_product jsonb;
  v_image jsonb;
  v_size_label text;
  v_product_id uuid;
  v_variant_id uuid;
  v_collection text;
  v_category text;
  v_tags text[];
  v_qty integer;
  v_position integer;
begin
  if exists (select 1 from public.products) then
    raise notice 'Catalogue already has products; seed skipped.';
    return;
  end if;

  for v_product in
    select value from jsonb_array_elements($catalog$[
      {
        "handle": "zohra-chikankari-midi-dress",
        "title": "Zohra Chikankari Midi Dress",
        "description": "A midi dress in ivory lawn worked entirely in white-on-white chikankari, with a modest neckline and a flare that moves without weight. Cut long through the body so it sits flat at the shoulder.",
        "fabric": "Fine cotton lawn",
        "care": "Cold hand wash separately; dry in shade.",
        "price": 14900,
        "category": "Dresses",
        "released_at": "2026-10-02",
        "collections": ["dresses"],
        "tags": ["chikankari", "midi", "ivory"],
        "sizes": ["XS", "S", "M", "L"],
        "images": [
          {"url": "/images/products/p-zohra.jpg", "alt": "Zohra Chikankari Midi Dress in ivory cotton lawn, front view on a model."},
          {"url": "/images/lookbook/l1.jpg", "alt": "Zohra Chikankari Midi Dress photographed against a Lahore plaster wall."}
        ]
      },
      {
        "handle": "mehr-raw-silk-co-ord",
        "title": "Mehr Raw Silk Co-Ord",
        "description": "A boxy camp-collar shirt in matte raw silk, paired with a straight tailored trouser. The silk holds its shape through the day, so the line stays crisp from the first meeting to the last.",
        "fabric": "Raw silk",
        "care": "Dry clean only.",
        "price": 18500,
        "category": "Co-Ord Sets",
        "released_at": "2026-08-14",
        "collections": ["co-ord-sets"],
        "tags": ["raw silk", "co-ord", "ink black"],
        "sizes": ["S", "M", "L", "XL"],
        "images": [
          {"url": "/images/products/p-mehr.jpg", "alt": "Mehr Raw Silk Co-Ord: black raw silk shirt and straight trousers, front view."},
          {"url": "/images/lookbook/l2.jpg", "alt": "Models in linen and raw-silk co-ords seated on a charpai."}
        ]
      },
      {
        "handle": "rani-zardozi-formal-gown",
        "title": "Rani Zardozi Formal Gown",
        "description": "A floor-length gown in garnet silk canvas, finished with hand zardozi along the hem and cuffs. The bodice is structured, the skirt left quiet — the embroidery does the speaking.",
        "fabric": "Silk canvas with gold zardozi",
        "care": "Dry clean only; store flat.",
        "price": 32000,
        "compare_at_price": 39500,
        "category": "Dresses",
        "released_at": "2026-05-20",
        "collections": ["dresses"],
        "tags": ["zardozi", "formal", "garnet"],
        "sizes": ["XS", "S", "M"],
        "images": [
          {"url": "/images/products/p-rani.jpg", "alt": "Rani Zardozi Formal Gown in garnet silk with gold embroidered hem, front view."}
        ]
      },
      {
        "handle": "sahil-linen-shirt-trouser",
        "title": "Sahil Linen Shirt & Trouser",
        "description": "A camp-collar shirt in washed stone linen with a rolled sleeve, cut to sit over wide straight trousers. Made for long afternoons — the linen softens rather than creases badly.",
        "fabric": "Washed linen",
        "care": "Machine wash cold on gentle; iron damp.",
        "price": 12900,
        "category": "Ready to Wear",
        "released_at": "2026-07-08",
        "collections": ["ready-to-wear", "co-ord-sets"],
        "tags": ["linen", "co-ord", "stone"],
        "sizes": ["S", "M", "L", "XL"],
        "images": [
          {"url": "/images/products/p-sahil.jpg", "alt": "Sahil Linen Shirt and Trouser set in stone beige linen, front view."},
          {"url": "/images/lookbook/l2.jpg", "alt": "Sahil linen set in a sunlit courtyard."}
        ]
      },
      {
        "handle": "noor-ochre-kurta-set",
        "title": "Noor Ochre Kurta Set",
        "description": "A straight kurta in ochre cotton slub with a small hand-blocked motif down the placket, matched to plain straight pants. The block print is deliberately sparse so it reads as texture, not pattern.",
        "fabric": "Cotton slub with block print",
        "care": "First wash separate; cold machine wash.",
        "price": 9800,
        "compare_at_price": 12400,
        "category": "Ready to Wear",
        "released_at": "2026-04-11",
        "collections": ["ready-to-wear"],
        "tags": ["block print", "kurta", "ochre"],
        "sizes": ["XS", "S", "M", "L", "XL"],
        "images": [
          {"url": "/images/products/p-noor.jpg", "alt": "Noor Ochre Kurta Set: block-printed ochre kurta with straight pants."}
        ]
      },
      {
        "handle": "gul-rose-gharara-set",
        "title": "Gul Rose Gharara Set",
        "description": "A short kurta with gathered flowing trousers in dusty rose silk cotton, finished with a plain organza dupatta. The gather sits low on the hip so the volume falls from the knee, not the waist.",
        "fabric": "Silk cotton with organza dupatta",
        "care": "Dry clean only.",
        "price": 24500,
        "category": "Co-Ord Sets",
        "released_at": "2026-10-10",
        "collections": ["co-ord-sets"],
        "tags": ["gharara", "organza", "dusty rose"],
        "sizes": ["S", "M", "L"],
        "images": [
          {"url": "/images/products/p-gul.jpg", "alt": "Gul Rose Gharara Set with organza dupatta, front view on a model."},
          {"url": "/images/lookbook/l4.jpg", "alt": "Gul Rose Gharara Set on a rooftop at dusk."}
        ]
      },
      {
        "handle": "sitara-embellished-evening-dress",
        "title": "Sitara Embellished Evening Dress",
        "description": "A column evening dress in ink crepe with tonal beadwork concentrated at the shoulder, so the light catches it only when you move. No contrast, no sequin spill — one quiet surface of work.",
        "fabric": "Crepe with tonal beadwork",
        "care": "Dry clean only; do not hang beaded section.",
        "price": 38000,
        "category": "Dresses",
        "released_at": "2026-09-28",
        "collections": ["dresses"],
        "tags": ["evening", "beaded", "ink black"],
        "sizes": ["XS", "S", "M", "L"],
        "images": [
          {"url": "/images/products/p-sitara.jpg", "alt": "Sitara Embellished Evening Dress in ink black with tonal beadwork."},
          {"url": "/images/lookbook/l6.jpg", "alt": "Sitara evening dress in a carved Lahore courtyard."}
        ]
      },
      {
        "handle": "aman-ecru-shirt-dress",
        "title": "Aman Ecru Shirt Dress",
        "description": "An oversized ecru poplin shirt dress with dropped shoulders and a hem at mid-calf. Comes with a self belt, worn loose — the shape is meant to be lived in, not cinched.",
        "fabric": "Cotton poplin",
        "care": "Machine wash warm; tumble low.",
        "price": 8900,
        "compare_at_price": 11200,
        "category": "Ready to Wear",
        "released_at": "2026-03-30",
        "collections": ["ready-to-wear"],
        "tags": ["shirt dress", "poplin", "ecru"],
        "sizes": ["S", "M", "L", "XL"],
        "images": [
          {"url": "/images/products/p-aman.jpg", "alt": "Aman Ecru Shirt Dress in cotton poplin, worn loose with self belt."}
        ]
      },
      {
        "handle": "laila-emerald-kurta-dupatta",
        "title": "Laila Emerald Kurta with Dupatta",
        "description": "A straight kurta in deep emerald silk blend, sold with a plain ivory dupatta finished with a narrow hand-rolled edge. Worn together it reads formal; apart, the kurta is everyday.",
        "fabric": "Silk blend with ivory dupatta",
        "care": "Dry clean recommended for the dupatta.",
        "price": 16700,
        "category": "Ready to Wear",
        "released_at": "2026-06-18",
        "collections": ["ready-to-wear"],
        "tags": ["kurta", "dupatta", "emerald"],
        "sizes": ["XS", "S", "M", "L"],
        "images": [
          {"url": "/images/products/p-laila.jpg", "alt": "Laila Emerald Kurta with contrasting ivory dupatta, front view."},
          {"url": "/images/lookbook/l3.jpg", "alt": "Laila emerald kurta walking through a sandstone corridor."}
        ]
      },
      {
        "handle": "nadia-champagne-silk-slip",
        "title": "Nadia Champagne Silk Slip Dress",
        "description": "A bias-cut champagne slip with resham floral embroidery only at the neckline. Cut on the true bias so the fabric skims rather than clings — it needs no lining to fall well.",
        "fabric": "Bias-cut silk with resham embroidery",
        "care": "Dry clean only.",
        "price": 21300,
        "category": "Dresses",
        "released_at": "2026-10-16",
        "collections": ["dresses"],
        "tags": ["slip dress", "silk", "champagne"],
        "sizes": ["XS", "S", "M", "XL"],
        "images": [
          {"url": "/images/products/p-nadia.jpg", "alt": "Nadia Champagne Silk Slip Dress with resham embroidery at the neckline."},
          {"url": "/images/lookbook/l5.jpg", "alt": "Seated portrait in the Nadia champagne silk slip."}
        ]
      },
      {
        "handle": "zubia-charcoal-trouser-tunic",
        "title": "Zubia Charcoal Trouser & Tunic",
        "description": "A short boxy tunic in charcoal wool blend over a wide-leg tailored trouser. The suiting has enough body to hold the wide leg, which is the whole point of the set.",
        "fabric": "Wool-blend suiting",
        "care": "Dry clean only; steam to refresh.",
        "price": 15400,
        "category": "Co-Ord Sets",
        "released_at": "2026-09-05",
        "collections": ["co-ord-sets"],
        "tags": ["suiting", "co-ord", "charcoal"],
        "sizes": ["S", "M", "L"],
        "images": [
          {"url": "/images/products/p-zubia.jpg", "alt": "Zubia Charcoal Trouser and Tunic co-ord, front view."}
        ]
      },
      {
        "handle": "ira-sand-cape-kurta",
        "title": "Ira Sand Cape Kurta",
        "description": "A sleeveless voile cape layered over a simple straight kurta and trousers in sand. The cape is unlined and unhurried — it moves before the rest of the outfit does.",
        "fabric": "Cotton voile over kurta",
        "care": "Hand wash cold; reshape while damp.",
        "price": 11600,
        "compare_at_price": 14800,
        "category": "Ready to Wear",
        "released_at": "2026-05-02",
        "collections": ["ready-to-wear"],
        "tags": ["cape", "kurta", "sand"],
        "sizes": ["XS", "S", "L", "XL"],
        "images": [
          {"url": "/images/products/p-ira.jpg", "alt": "Ira Sand Cape Kurta with layered voile cape, front view."}
        ]
      }
    ]$catalog$::jsonb)
  loop
    v_category := coalesce(v_product ->> 'category', '');
    v_tags := array(
      select jsonb_array_elements_text(coalesce(v_product -> 'tags', '[]'::jsonb))
    );
    if (v_product ->> 'compare_at_price') is not null then
      v_tags := array_append(v_tags, 'sale');
    end if;

    insert into public.products (
      handle, title, description, fabric, care, released_at, brand, vendor,
      category, product_type, status, price, compare_at_price, sku, tags,
      search_keywords, seo_title, seo_description, published_at
    ) values (
      v_product ->> 'handle',
      v_product ->> 'title',
      coalesce(v_product ->> 'description', ''),
      coalesce(v_product ->> 'fabric', ''),
      coalesce(v_product ->> 'care', ''),
      (v_product ->> 'released_at')::date,
      'HALA.S',
      'HALA.S',
      v_category,
      v_category,
      'published',
      (v_product ->> 'price')::numeric,
      nullif(v_product ->> 'compare_at_price', '')::numeric,
      'HLS-' || upper(left(regexp_replace(v_product ->> 'handle', '[^a-z0-9]', '', 'g'), 8)),
      v_tags,
      v_tags || array['halas', 'pakistani womenswear'],
      (v_product ->> 'title') || ' — HALA.S CLOTHING',
      left(coalesce(v_product ->> 'description', ''), 300),
      (v_product ->> 'released_at')::date::timestamptz + time '10:00'
    )
    returning id into v_product_id;

    v_position := 0;
    for v_image in select value from jsonb_array_elements(coalesce(v_product -> 'images', '[]'::jsonb))
    loop
      v_position := v_position + 1;
      insert into public.product_images (product_id, url, alt, position, is_primary)
      values (
        v_product_id,
        v_image ->> 'url',
        coalesce(v_image ->> 'alt', ''),
        v_position,
        v_position = 1
      );
    end loop;

    foreach v_size_label in array array['XS', 'S', 'M', 'L', 'XL']
    loop
      v_qty := case
        when (v_product -> 'sizes') @> to_jsonb(v_size_label) then 6 + (length(v_product ->> 'handle') % 4)
        else 0
      end;
      insert into public.product_variants (
        product_id, sku, title, size, colour, colour_hex, position, is_active
      ) values (
        v_product_id,
        'HLS-' || upper(left(regexp_replace(v_product ->> 'handle', '[^a-z0-9]', '', 'g'), 6)) || '-' || v_size_label,
        v_size_label,
        v_size_label,
        '',
        '',
        array_position(array['XS', 'S', 'M', 'L', 'XL'], v_size_label),
        true
      )
      returning id into v_variant_id;

      insert into public.inventory_levels (variant_id, quantity, reserved_quantity, low_stock_threshold)
      values (v_variant_id, v_qty, 0, 3);

      insert into public.inventory_movements (
        variant_id, type, quantity_change, reserved_change,
        quantity_after, reserved_after, reason
      ) values (
        v_variant_id, 'set', v_qty, 0, v_qty, 0, 'Initial catalogue seed'
      );
    end loop;
  end loop;

  insert into public.collections (
    handle, title, description, image_url, seo_title, seo_description,
    status, is_automatic, rules, position
  ) values
    (
      'new-in', 'New In',
      'The latest cuts, fresh off the atelier floor.',
      '/images/lookbook/l1.jpg',
      'New In — HALA.S CLOTHING',
      'The latest HALA.S cuts, fresh off the atelier floor.',
      'published', true,
      '{"match":"all","conditions":[{"field":"released_within_days","operator":"lte","value":"35"}]}'::jsonb,
      1
    ),
    (
      'sale', 'Sale',
      'End-of-season pieces, honestly reduced.',
      '/images/products/p-rani.jpg',
      'Sale — HALA.S CLOTHING',
      'End-of-season HALA.S pieces, honestly reduced.',
      'published', true,
      '{"match":"all","conditions":[{"field":"on_sale","operator":"equals","value":"true"}]}'::jsonb,
      2
    ),
    (
      'ready-to-wear', 'Ready to Wear',
      'Everyday tailoring with an editorial hand.',
      '/images/products/p-sahil.jpg',
      'Ready to Wear — HALA.S CLOTHING',
      'Everyday HALA.S tailoring with an editorial hand.',
      'published', false, '{"match":"all","conditions":[]}'::jsonb, 3
    ),
    (
      'dresses', 'Dresses',
      'From lawn afternoons to formal nights.',
      '/images/products/p-zohra.jpg',
      'Dresses — HALA.S CLOTHING',
      'HALA.S dresses, from lawn afternoons to formal nights.',
      'published', false, '{"match":"all","conditions":[]}'::jsonb, 4
    ),
    (
      'co-ord-sets', 'Co-Ord Sets',
      'Matched sets, considered to the millimetre.',
      '/images/products/p-mehr.jpg',
      'Co-Ord Sets — HALA.S CLOTHING',
      'Matched HALA.S sets, considered to the millimetre.',
      'published', false, '{"match":"all","conditions":[]}'::jsonb, 5
    ),
    (
      'all', 'All Products',
      'The complete HALA.S wardrobe.',
      '/images/campaign/hero-wide.jpg',
      'Shop All — HALA.S CLOTHING',
      'The complete HALA.S wardrobe.',
      'published', true,
      '{"match":"all","conditions":[{"field":"status","operator":"equals","value":"published"}]}'::jsonb,
      6
    );

  insert into public.collection_products (collection_id, product_id, position)
  select c.id, p.id, row_number() over (partition by c.id order by p.published_at desc)
    from public.collections c
    join public.products p
      on (
        (c.handle = 'ready-to-wear' and p.category = 'Ready to Wear')
        or (c.handle = 'dresses' and p.category = 'Dresses')
        or (c.handle = 'co-ord-sets' and p.category = 'Co-Ord Sets')
        or (c.handle = 'co-ord-sets' and p.handle = 'sahil-linen-shirt-trouser')
      )
   where c.handle in ('ready-to-wear', 'dresses', 'co-ord-sets');

  update public.product_variants pv
     set colour = c.colour,
         colour_hex = c.hex
    from public.products p,
         (values
           ('zohra-chikankari-midi-dress', 'Ivory', '#efe9dc'),
           ('mehr-raw-silk-co-ord', 'Ink Black', '#16140f'),
           ('rani-zardozi-formal-gown', 'Garnet', '#6d1f26'),
           ('sahil-linen-shirt-trouser', 'Stone', '#c3bcac'),
           ('noor-ochre-kurta-set', 'Ochre', '#c8922e'),
           ('gul-rose-gharara-set', 'Dusty Rose', '#c08b8b'),
           ('sitara-embellished-evening-dress', 'Ink Black', '#1a1815'),
           ('aman-ecru-shirt-dress', 'Ecru', '#e6ddcb'),
           ('laila-emerald-kurta-dupatta', 'Deep Emerald', '#1f3d33'),
           ('nadia-champagne-silk-slip', 'Champagne', '#d9c8a8'),
           ('zubia-charcoal-trouser-tunic', 'Charcoal', '#3c3b39'),
           ('ira-sand-cape-kurta', 'Sand', '#cdbfa3')
         ) as c(handle, colour, hex)
   where pv.product_id = p.id
     and p.handle = c.handle;

  update public.store_settings
     set currency = 'PKR',
         cod_enabled = true
   where id = 1;

  perform public.log_activity('catalogue.seeded', 'system', '', jsonb_build_object(
    'products', (select count(*) from public.products),
    'collections', (select count(*) from public.collections)
  ));
end;
$$;
