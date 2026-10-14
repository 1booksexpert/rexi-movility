// src/pages/api/zones.post.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    
    // Extraer los arrays de datos del formulario
    const zoneNames = formData.getAll('zoneName');
    const baseFares = formData.getAll('baseFare');
    const pricesPerKm = formData.getAll('pricePerKm');
    const coverageAreas = formData.getAll('coverageArea');
    const isActiveFlags = formData.getAll('isActive');

    const zones = zoneNames.map((name, index) => ({
      id: crypto.randomUUID(),
      name: name.toString(),
      baseFare: parseFloat(baseFares[index]?.toString() || '0'),
      pricePerKm: parseFloat(pricesPerKm[index]?.toString() || '0'),
      coverageArea: coverageAreas[index]?.toString() || '',
      // Si el checkbox no está marcado, no se envía en FormData, por lo que verificamos su existencia
      isActive: isActiveFlags.includes('on') || isActiveFlags.length > index 
    }));

    // TODO: Aquí guardas las zonas en tu base de datos
    // await db.zones.update(zones);

    return new Response(
      JSON.stringify({ success: true, message: 'Zonas actualizadas correctamente', zones }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: 'Error al guardar las zonas' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};