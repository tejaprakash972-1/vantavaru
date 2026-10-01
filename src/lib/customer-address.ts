import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCustomerAddressSummary(client: SupabaseClient, addressId: string): Promise<string | null> {
    const { data: address, error: addressError } = await client.from("customer_addresses")
        .select("label, flat_number, tower_block, address_line, landmark, society_id")
        .eq("id", addressId)
        .maybeSingle();
    if (addressError) throw addressError;
    if (!address) return null;

    const { data: society, error: societyError } = await client.from("societies")
        .select("name, pincode, area_id")
        .eq("id", address.society_id)
        .maybeSingle();
    if (societyError) throw societyError;

    const { data: area, error: areaError } = society ? await client.from("areas")
        .select("name, city_id")
        .eq("id", society.area_id)
        .maybeSingle() : { data: null, error: null };
    if (areaError) throw areaError;

    const { data: city, error: cityError } = area ? await client.from("cities")
        .select("name")
        .eq("id", area.city_id)
        .maybeSingle() : { data: null, error: null };
    if (cityError) throw cityError;

    return [address.label, address.flat_number, address.tower_block, address.address_line, address.landmark, society?.name, area?.name, city?.name, society?.pincode].filter(Boolean).join(", ");
}