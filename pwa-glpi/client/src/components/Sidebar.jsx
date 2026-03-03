import React, { useState } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    User,
    LogOut,
    Settings,
    ChevronDown,
    LayoutDashboard,
    Wrench,
    Hammer,
    Package,
    Calendar,
    CalendarDays,
    ListTodo,
    ShoppingBag,
    LifeBuoy,
    History,
    Building2,
    RefreshCw
} from 'lucide-react';
import { cn } from '../utils/cn';

const navItems = [
    { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'form-preventive', label: 'Preventivo', icon: Wrench },
    { id: 'form-corrective', label: 'Correctivo', icon: Hammer },
    { id: 'form-delivery', label: 'Entrega', icon: Package },
    {
        id: 'tasks',
        label: 'Tareas',
        icon: Calendar,
        children: [
            { id: 'kanban', label: 'Calendario', icon: CalendarDays },
            { id: 'task-list', label: 'Lista de Tareas', icon: ListTodo }
        ]
    },
    { id: 'quotations', label: 'Cotizaciones', icon: ShoppingBag },
    { id: 'tickets', label: 'Soporte GLPI', icon: LifeBuoy },
    { id: 'history', label: 'Actas', icon: History },
];

const Sidebar = ({ activeView, onViewChange, user, onLogout, isCollapsed, onToggleCollapse }) => {
    return (
        <aside className={cn(
            "fixed inset-y-0 left-0 z-[110] flex flex-col bg-secondary border-r border-color transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-2xl lg:shadow-none",
            isCollapsed ? "w-[68px]" : "w-[238px]"
        )}>
            {/* Sidebar Header */}
            <div
                onClick={() => onViewChange('home')}
                className="h-[62px] border-b border-color flex items-center justify-center p-4 cursor-pointer hover:bg-tertiary/20 transition-all group/header"
            >
                <div className={cn(
                    "w-8 h-8 rounded-lg bg-[#0695c4] flex items-center justify-center text-white font-black transition-all",
                    isCollapsed ? "rotate-0 shadow-lg" : "rotate-45 group-hover/header:rotate-0 group-hover/header:shadow-md"
                )}>
                    T
                </div>
                {!isCollapsed && (
                    <span className="ml-3 font-black text-text-primary text-[15px] uppercase tracking-tighter animate-in fade-in duration-500 group-hover/header:text-[#0695c4] transition-colors">
                        TicketSign
                    </span>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto no-scrollbar py-4 px-3 flex flex-col gap-0.5">
                <SidebarSection label="Principal" isCollapsed={isCollapsed}>
                    {navItems.map((item) => {
                        const isChildActive = item.children?.some(c => c.id === activeView);
                        const isActive = activeView === item.id || isChildActive;

                        return (
                            <SidebarItem
                                key={item.id}
                                item={item}
                                isActive={isActive}
                                currentView={activeView}
                                isCollapsed={isCollapsed}
                                onClick={(childId) => onViewChange(childId || item.id)}
                            />
                        );
                    })}
                </SidebarSection>

                <div className="border-t border-color my-2 mx-2"></div>

                <SidebarSection label="Reportes" isCollapsed={isCollapsed}>
                    <SidebarItem
                        item={{ id: 'consolidated', label: 'Consolidado Empresas', icon: Building2 }}
                        isActive={activeView === 'consolidated'}
                        isCollapsed={isCollapsed}
                        onClick={() => onViewChange('consolidated')}
                    />
                </SidebarSection>

                <div className="border-t border-color my-2 mx-2"></div>

                <SidebarSection label="Sistema" isCollapsed={isCollapsed}>
                    <SidebarItem
                        item={{ id: 'sync', label: 'Sincronización', icon: RefreshCw }}
                        isActive={activeView === 'sync'}
                        isCollapsed={isCollapsed}
                        onClick={() => onViewChange('sync')}
                    />
                    {['Super-Admin', 'Admin-Mesa'].some(r => user?.profile?.includes(r)) && (
                        <SidebarItem
                            item={{ id: 'config', label: 'Configuración', icon: Settings }}
                            isActive={activeView === 'config'}
                            isCollapsed={isCollapsed}
                            onClick={() => onViewChange('config')}
                        />
                    )}
                    <SidebarItem
                        item={{ id: 'logout', label: 'Cerrar sesión', icon: LogOut }}
                        isActive={false}
                        isCollapsed={isCollapsed}
                        onClick={onLogout}
                    />
                </SidebarSection>
            </nav>

            {/* Collapse Toggle Button (Bottom) */}
            <div className="p-3 border-t border-color">
                <button
                    onClick={onToggleCollapse}
                    className={cn(
                        "w-full h-10 rounded-xl flex items-center gap-3 px-3 hover:bg-tertiary text-text-secondary transition-all overflow-hidden relative group/btn",
                        isCollapsed && "justify-center"
                    )}
                >
                    <div className={cn("transition-transform duration-500", isCollapsed && "rotate-180")}>
                        <ChevronLeft size={18} className="group-hover/btn:text-[#0695c4]" />
                    </div>
                    {!isCollapsed && (
                        <span className="text-[12px] font-bold uppercase tracking-widest whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
                            Colapsar Menú
                        </span>
                    )}
                </button>
            </div>
        </aside>
    );
};

const SidebarSection = ({ label, children, isCollapsed }) => (
    <div className="flex flex-col gap-[2px]">
        {!isCollapsed && (
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-[1px] px-3 pt-[10px] pb-[5px] animate-in fade-in duration-300">
                {label}
            </p>
        )}
        {children}
    </div>
);

const SidebarItem = ({ item, isActive, currentView, onClick, isChild = false, isCollapsed = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [popoverTop, setPopoverTop] = useState(0);
    const itemRef = React.useRef(null);
    const hoverTimeoutRef = React.useRef(null);
    const hasChildren = item.children && item.children.length > 0;
    const Icon = item.icon;

    const handleMouseEnter = () => {
        if (!isCollapsed) return;
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

        if (itemRef.current) {
            const rect = itemRef.current.getBoundingClientRect();
            setPopoverTop(rect.top);
        }
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        if (!isCollapsed) return;
        hoverTimeoutRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 150); // Small delay to allow crossing the gap
    };

    return (
        <div
            className="flex flex-col relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                ref={itemRef}
                onClick={() => {
                    if (hasChildren) {
                        setIsOpen(!isOpen);
                    } else {
                        onClick();
                    }
                }}
                className={cn(
                    "w-full flex items-center px-3 py-[9px] rounded-lg transition-all relative outline-none gap-[10px] group/item",
                    isActive && !hasChildren
                        ? "bg-tertiary text-[#0695c4] font-semibold border-l-[3px] border-[#0695c4] pl-[9px] shadow-sm"
                        : "text-text-secondary font-medium hover:bg-tertiary",
                    isChild && "pl-8 py-[7px]",
                    isCollapsed && "justify-center px-0 hover:scale-105"
                )}
            >
                <div className={cn(
                    "flex-shrink-0 w-[20px] h-[20px] flex items-center justify-center transition-all",
                    isActive && !hasChildren ? "text-primary-500" : "text-text-muted group-hover/item:text-[#0695c4]",
                    isCollapsed && "w-[24px] h-[24px]"
                )}>
                    {Icon && <Icon size={isCollapsed ? 20 : 17} strokeWidth={isActive ? 2.5 : 2} />}
                </div>

                {!isCollapsed && (
                    <span className={cn(
                        "text-[13.5px] tracking-tight text-left flex-1 animate-in fade-in slide-in-from-left-1 duration-200",
                        isChild && "text-[12.5px]"
                    )}>
                        {item.label}
                    </span>
                )}

                {item.badge && !isCollapsed && (
                    <span className={cn(
                        "text-[10px] font-bold px-[7px] py-[1px] rounded-[10px] animate-in zoom-in duration-300",
                        item.badge.type === 'urgent' ? "bg-secondary text-red-500 border border-red-500" :
                            item.badge.type === 'pending' ? "bg-secondary text-amber-600 dark:text-amber-500 border border-amber-500" :
                                item.badge.type === 'ok' ? "bg-secondary text-emerald-600 dark:text-emerald-500 border border-emerald-500" :
                                    "bg-secondary text-primary-500 border border-primary-500 shadow-sm"
                    )}>
                        {item.badge.text}
                    </span>
                )}

                {hasChildren && !isCollapsed && (
                    <ChevronDown size={14} className={cn("text-text-muted transition-transform", (isOpen || isActive) ? "rotate-180" : "")} />
                )}
            </button>

            {/* Expanded Submenu for Normal Sidebar */}
            {hasChildren && (isOpen || isActive) && !isCollapsed && (
                <div className="flex flex-col gap-1 mt-1 mb-1">
                    {item.children.map(child => (
                        <SidebarItem
                            key={child.id}
                            item={child}
                            currentView={currentView}
                            isActive={currentView === child.id}
                            onClick={() => onClick(child.id)}
                            isChild={true}
                        />
                    ))}
                </div>
            )}

            {/* Floating Popover / Submenu for Collapsed Sidebar */}
            {isCollapsed && isHovered && (
                <div
                    className="fixed left-[60px] w-[240px] z-[200] flex items-center animate-in fade-in slide-in-from-left-2 duration-200 pointer-events-none"
                    style={{ top: `${popoverTop}px`, height: '44px' }}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <div className="bg-secondary/98 backdrop-blur-xl border border-color rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] min-w-[200px] py-1.5 ml-2 pointer-events-auto border-l-primary-500/40 relative">
                        {/* Bridge to prevent hover exit */}
                        <div className="absolute top-0 -left-4 bottom-0 w-4 pointer-events-auto" />
                        {/* Header of popover (Parent Item Label) */}
                        <div className="px-5 py-3 bg-tertiary/60 border-b border-color mb-1.5 flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(6,149,196,0.5)]" />
                            <span className="text-[11px] font-black text-[#0695c4] uppercase tracking-[1.5px] whitespace-nowrap">{item.label}</span>
                        </div>

                        {hasChildren ? (
                            <div className="flex flex-col px-2 gap-2 my-0.5">
                                {item.children.map(child => (
                                    <button
                                        key={child.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onClick(child.id);
                                            setIsHovered(false);
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all hover:bg-tertiary group/sub relative overflow-hidden",
                                            currentView === child.id ? "bg-primary-500/10 text-primary-500 font-black" : "text-text-secondary font-semibold hover:text-text-primary"
                                        )}
                                    >
                                        <child.icon size={16} className={cn("transition-colors shrink-0", currentView === child.id ? "text-primary-500" : "text-text-muted group-hover/sub:text-primary-500")} />
                                        <span className="text-[13px] tracking-tight whitespace-nowrap">{child.label}</span>
                                        {currentView === child.id && (
                                            <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary-500" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="px-5 py-2">
                                <span className="text-[12px] text-text-muted font-medium italic opacity-80">Sección principal</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
export default Sidebar;
