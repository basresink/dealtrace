-- Helpcenter: een derde collectie "Nieuwe klanten werven" (werven), met artikelen uit eigen
-- vakliteratuur. De herkomst staat per artikel in data->>'bron'.
alter table help_artikelen drop constraint if exists help_artikelen_collectie_check;
alter table help_artikelen add constraint help_artikelen_collectie_check check (collectie in ('product', 'newbusiness', 'werven'));
