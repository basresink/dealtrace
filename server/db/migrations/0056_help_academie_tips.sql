-- Helpcenter: Nieuwe klanten werven is een hoofdstuk van de new business-academie geworden (de artikelen
-- houden hun categorie en hun bron in data->>'bron'), en er is een collectie Tips & Tricks (tips).
update help_artikelen set collectie = 'newbusiness' where collectie = 'werven';
alter table help_artikelen drop constraint if exists help_artikelen_collectie_check;
alter table help_artikelen add constraint help_artikelen_collectie_check check (collectie in ('product', 'newbusiness', 'tips'));
