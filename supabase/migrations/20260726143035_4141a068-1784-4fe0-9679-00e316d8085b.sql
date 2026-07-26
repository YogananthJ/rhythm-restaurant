
REVOKE ALL ON FUNCTION public.recalc_order(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._require_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_add_order_item(uuid,uuid,int,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_update_order_item(uuid,int,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_remove_order_item(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_set_order_charges(uuid,int,int,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_apply_coupon(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_add_payment(uuid,text,int,int,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_void_payment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_close_order(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_split_order(uuid,uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_merge_orders(uuid,uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public._require_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_add_order_item(uuid,uuid,int,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_update_order_item(uuid,int,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_remove_order_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_set_order_charges(uuid,int,int,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_apply_coupon(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_add_payment(uuid,text,int,int,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_void_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_close_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_split_order(uuid,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_merge_orders(uuid,uuid) TO authenticated;
