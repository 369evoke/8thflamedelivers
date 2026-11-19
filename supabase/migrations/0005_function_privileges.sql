-- Trigger function is never callable via the API; RLS helpers only for signed-in users.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.current_user_role(), public.is_staff(), public.is_ops(), public.is_admin(), public.is_finance(),
  public.current_driver_id(), public.is_business_member(uuid), public.is_business_admin(uuid),
  public.driver_assigned_to(uuid), public.can_view_shipment(uuid) from public, anon;
grant execute on function public.current_user_role(), public.is_staff(), public.is_ops(), public.is_admin(), public.is_finance(),
  public.current_driver_id(), public.is_business_member(uuid), public.is_business_admin(uuid),
  public.driver_assigned_to(uuid), public.can_view_shipment(uuid) to authenticated, service_role;
