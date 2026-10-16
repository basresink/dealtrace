<script setup lang="ts">
// Lucide-iconen op naam (hoofdstuk 14). Alleen de iconen die de app gebruikt,
// zodat de bundel klein blijft.
import {
  Archive, BookOpen, Building2, Calendar, CalendarRange, ChartColumn, ChartLine, ChevronDown, CircleAlert,
  CircleCheck, CircleHelp, Compass, Filter, House, Lightbulb, Lock, LogOut, MapPin, Megaphone, MessagesSquare,
  PanelLeft, Pencil, Phone, Plus, RefreshCw, Route, ScrollText, Search, Server, Settings, Sparkles, SquareCheck,
  UserCog, UserPlus, Users, UsersRound, WifiOff, X, Bell,
  Globe, Mail, MessageCircle, Navigation, Ellipsis, ArrowLeft, ArrowRight, Trash2, GripVertical, Download, Merge, LayoutList, LayoutGrid,
  List, ArrowUpDown, Star, Ban, Link, Linkedin, Info, Save, UserX, Bookmark, PhoneOff, Briefcase, Clock, StickyNote, Pause, CircleX, CircleDot, Mic, Volume2, VolumeX, Camera, Square, LocateFixed, Inbox, TriangleAlert, Handshake, CircleUser, ChevronUp, Upload, FileText, Image, File, SlidersHorizontal, ExternalLink, Database, ShieldCheck, Copy, ListTodo,
} from 'lucide-vue-next'

const ICONEN = {
  Archive, BookOpen, Building2, Calendar, CalendarRange, ChartColumn, ChartLine, ChevronDown, CircleAlert,
  CircleCheck, CircleHelp, Compass, Filter, House, Lightbulb, Lock, LogOut, MapPin, Megaphone, MessagesSquare,
  PanelLeft, Pencil, Phone, Plus, RefreshCw, Route, ScrollText, Search, Server, Settings, Sparkles, SquareCheck,
  UserCog, UserPlus, Users, UsersRound, WifiOff, X, Bell,
  Globe, Mail, MessageCircle, Navigation, Ellipsis, ArrowLeft, ArrowRight, Trash2, GripVertical, Download, Merge, LayoutList, LayoutGrid,
  List, ArrowUpDown, Star, Ban, Link, Linkedin, Info, Save, UserX, Bookmark, PhoneOff, Briefcase, Clock, StickyNote, Pause, CircleX, CircleDot, Mic, Volume2, VolumeX, Camera, Square, LocateFixed, Inbox, TriangleAlert, Handshake, CircleUser, ChevronUp, Upload, FileText, Image, File, SlidersHorizontal, ExternalLink, Database, ShieldCheck, Copy, ListTodo,
} as const

const props = defineProps<{ naam: string; grootte?: number }>()
const comp = computed(() => ICONEN[props.naam as keyof typeof ICONEN] ?? CircleHelp)
</script>

<template>
  <component :is="comp" class="icoon" :size="grootte ?? 18" :stroke-width="2" aria-hidden="true" />
</template>
