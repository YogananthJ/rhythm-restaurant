
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin','manager','kitchen','waiter','host','customer');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable to authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile writable" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile insertable" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile on signup + default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'manager');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Restaurants (single-tenant demo, but modelled properly)
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.restaurants TO anon, authenticated;
GRANT ALL ON public.restaurants TO service_role;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restaurants public read" ON public.restaurants FOR SELECT USING (true);
CREATE POLICY "admins manage restaurants" ON public.restaurants FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.dining_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  seats INT NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','seated','reserved','cleaning')),
  qr_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(8),'hex'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dining_tables TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.dining_tables TO authenticated;
GRANT ALL ON public.dining_tables TO service_role;
ALTER TABLE public.dining_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tables public read" ON public.dining_tables FOR SELECT USING (true);
CREATE POLICY "staff manage tables" ON public.dining_tables FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'host') OR public.has_role(auth.uid(),'waiter'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'host') OR public.has_role(auth.uid(),'waiter'));

CREATE TABLE public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.menu_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.menu_categories TO authenticated;
GRANT ALL ON public.menu_categories TO service_role;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.menu_categories FOR SELECT USING (true);
CREATE POLICY "managers write categories" ON public.menu_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INT NOT NULL DEFAULT 0,
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  prep_minutes INT NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu public read" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "managers write menu" ON public.menu_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'kitchen'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'kitchen'));

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id UUID REFERENCES public.dining_tables(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','placed','preparing','ready','served','paid','cancelled')),
  guest_name TEXT,
  total_cents INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO anon, authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders public read" ON public.orders FOR SELECT USING (true);
CREATE POLICY "orders guests can create" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "staff update orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'kitchen') OR public.has_role(auth.uid(),'waiter'))
  WITH CHECK (true);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id),
  name_snapshot TEXT NOT NULL,
  unit_price_cents INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','preparing','ready','served','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.order_items TO anon, authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items public read" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "order_items guests create" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "staff update order_items" ON public.order_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'kitchen') OR public.has_role(auth.uid(),'waiter'))
  WITH CHECK (true);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER touch_menu_items BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER touch_orders BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER touch_tables BEFORE UPDATE ON public.dining_tables FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dining_tables;

-- Seed demo restaurant + tables + menu
INSERT INTO public.restaurants (id, name, slug) VALUES ('11111111-1111-1111-1111-111111111111','Occupancy Demo Kitchen','demo');

INSERT INTO public.dining_tables (restaurant_id, label, seats, status) VALUES
 ('11111111-1111-1111-1111-111111111111','T1',2,'available'),
 ('11111111-1111-1111-1111-111111111111','T2',4,'seated'),
 ('11111111-1111-1111-1111-111111111111','T3',4,'available'),
 ('11111111-1111-1111-1111-111111111111','T4',6,'reserved'),
 ('11111111-1111-1111-1111-111111111111','T5',2,'cleaning'),
 ('11111111-1111-1111-1111-111111111111','T6',4,'seated');

INSERT INTO public.menu_categories (id, restaurant_id, name, sort_order) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Starters',1),
 ('aaaaaaaa-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Mains',2),
 ('aaaaaaaa-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Desserts',3),
 ('aaaaaaaa-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Drinks',4);

INSERT INTO public.menu_items (restaurant_id, category_id, name, description, price_cents, prep_minutes, is_available) VALUES
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','Truffle Arancini','Crispy risotto balls, black truffle, parmesan foam',1200,8,true),
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','Burrata & Heirloom','Creamy burrata, heirloom tomatoes, basil oil',1400,5,true),
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000002','Wagyu Burger','Aged cheddar, brioche, truffle aioli',2400,14,true),
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000002','Miso Black Cod','Glazed cod, jasmine rice, bok choy',3200,18,true),
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000002','Wild Mushroom Risotto','Porcini, chanterelle, aged parmesan',2200,16,false),
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000003','Basque Cheesecake','Burnt top, vanilla cream, berry compote',1100,4,true),
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000003','Dark Chocolate Fondant','Molten centre, salted caramel ice cream',1300,12,true),
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000004','Yuzu Spritz','Prosecco, yuzu, elderflower',1400,2,true),
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000004','Cold Brew','House 18-hour cold brew, oat milk',600,1,true);
