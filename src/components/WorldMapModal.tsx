import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import {
  X,
  Compass,
  MapPin,
  Route,
  Sparkles,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  Filter,
  Plus,
  Info,
  Footprints,
  Navigation,
  ShieldAlert,
  ChevronRight,
  BookOpen,
  Send,
  Eye,
} from "lucide-react";
import {
  ActiveGameState,
  WorldMapLocation,
  WorldMapConnection,
  WorldMapMode,
  LorebookEntry,
} from "../types";
import { sound } from "../utils/audio";

interface WorldMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: ActiveGameState;
  onExecuteAction?: (actionText: string) => void;
  onAddLorebookEntry?: (entry: LorebookEntry) => void;
  isEmbeddedSection?: boolean; // When rendered as a full-page view inside StoryGameScreen
}

// Default canonical seed locations if story is in early steps and lorebook is still small
function generateDefaultWorldLocations(genre: string, universeName?: string): WorldMapLocation[] {
  const g = (genre || "").toLowerCase();
  if (g.includes("космо") || g.includes("sci-fi") || g.includes("кибер")) {
    return [
      {
        id: "loc_citadel",
        name: "Цитадель Нео-Орион",
        category: "capital",
        description: "Центральный мегаполис сектора с высотными шпилями корпораций и космопортом.",
        dangerLevel: 2,
        visitedSteps: [1],
        isCurrentLocation: true,
        isPastVisited: true,
        isFutureChoice: false,
        charactersHere: [],
        source: "canon",
      },
      {
        id: "loc_underbelly",
        name: "Трущобы Поднебесья",
        category: "wilds",
        description: "Нижние ярусы мегаполиса, освещенные неоном и контролируемые кибер-синдикатами.",
        dangerLevel: 4,
        visitedSteps: [],
        isCurrentLocation: false,
        isPastVisited: false,
        isFutureChoice: true,
        charactersHere: [],
        source: "canon",
      },
      {
        id: "loc_orbital_dock",
        name: "Орбитальный Док 'Эгида'",
        category: "city",
        description: "Станция стыковки межзвездных фрегатов и торговый хаб гиперпространственных путей.",
        dangerLevel: 1,
        visitedSteps: [],
        isCurrentLocation: false,
        isPastVisited: false,
        isFutureChoice: true,
        charactersHere: [],
        source: "canon",
      },
      {
        id: "loc_wasteland",
        name: "Пепельные Пустоши Внекуполья",
        category: "dungeon",
        description: "Радиоактивные руины старой эпохи за пределами энергощита города.",
        dangerLevel: 5,
        visitedSteps: [],
        isCurrentLocation: false,
        isPastVisited: false,
        isFutureChoice: false,
        charactersHere: [],
        source: "canon",
      },
    ];
  }

  // Fantasy / Default setting
  return [
    {
      id: "loc_capital",
      name: "Королевская Столица",
      category: "capital",
      description: "Белокаменный град с королевским замком, собором Света и гильдией магов.",
      dangerLevel: 1,
      visitedSteps: [1],
      isCurrentLocation: true,
      isPastVisited: true,
      isFutureChoice: false,
      charactersHere: [],
      source: "canon",
    },
    {
      id: "loc_forest",
      name: "Шепчущая Чаща",
      category: "wilds",
      description: "Древний заповедный лес, населенный духами, дриадами и скрытыми тропами эльфов.",
      dangerLevel: 3,
      visitedSteps: [],
      isCurrentLocation: false,
      isPastVisited: false,
      isFutureChoice: true,
      charactersHere: [],
      source: "canon",
    },
    {
      id: "loc_tavern",
      name: "Трактир «Скрещенные Клинки»",
      category: "sanctuary",
      description: "Уютный приют на перекрестке торговых трактов, где делятся слухами и нанимают спутников.",
      dangerLevel: 1,
      visitedSteps: [],
      isCurrentLocation: false,
      isPastVisited: false,
      isFutureChoice: true,
      charactersHere: [],
      source: "canon",
    },
    {
      id: "loc_dungeon",
      name: "Забытая Крипта Древних",
      category: "dungeon",
      description: "Катакомбы павшей цивилизации, скрывающие древние реликвии и ловушки.",
      dangerLevel: 5,
      visitedSteps: [],
      isCurrentLocation: false,
      isPastVisited: false,
      isFutureChoice: false,
      charactersHere: [],
      source: "canon",
    },
    {
      id: "loc_mountains",
      name: "Хребет Ледяного Ветра",
      category: "region",
      description: "Неприступные скалы на северном рубеже, охраняющие подступы к диким землям.",
      dangerLevel: 4,
      visitedSteps: [],
      isCurrentLocation: false,
      isPastVisited: false,
      isFutureChoice: false,
      charactersHere: [],
      source: "canon",
    },
  ];
}

export const WorldMapModal: React.FC<WorldMapModalProps> = ({
  isOpen,
  onClose,
  gameState,
  onExecuteAction,
  onAddLorebookEntry,
  isEmbeddedSection = false,
}) => {
  const [activeMode, setActiveMode] = useState<WorldMapMode>("unified");
  const [selectedLocation, setSelectedLocation] = useState<WorldMapLocation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);

  // New location form states
  const [newLocName, setNewLocName] = useState("");
  const [newLocDesc, setNewLocDesc] = useState("");
  const [newLocCat, setNewLocCat] = useState<WorldMapLocation["category"]>("city");
  const [newLocDanger, setNewLocDanger] = useState<number>(2);

  // D3 container refs
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // 1. EXTRACT AND ANALYZE LOCATIONS FROM STATE
  const { locations, connections, currentLocId } = useMemo(() => {
    const locMap = new Map<string, WorldMapLocation>();
    const links: WorldMapConnection[] = [];

    // A. Parse Canon Lorebook entries
    (gameState.lorebook || []).forEach((item, idx) => {
      const catLower = (item.category || "").toLowerCase();
      const isLoc =
        catLower.includes("локация") ||
        catLower.includes("регион") ||
        catLower.includes("мир") ||
        catLower.includes("место") ||
        catLower.includes("город") ||
        catLower.includes("замок");

      if (isLoc || item.title.length > 2) {
        const id = `lore_loc_${item.id || idx}`;
        let category: WorldMapLocation["category"] = "city";
        if (catLower.includes("столиц") || catLower.includes("замок")) category = "capital";
        else if (catLower.includes("чащ") || catLower.includes("лес") || catLower.includes("пустош")) category = "wilds";
        else if (catLower.includes("подземел") || catLower.includes("крипт") || catLower.includes("руин")) category = "dungeon";
        else if (catLower.includes("регион") || catLower.includes("горы")) category = "region";
        else if (catLower.includes("храм") || catLower.includes("башня") || catLower.includes("трактир")) category = "sanctuary";

        locMap.set(item.title.toLowerCase().trim(), {
          id,
          name: item.title,
          description: item.description,
          category,
          dangerLevel: 3,
          visitedSteps: [],
          isCurrentLocation: false,
          isPastVisited: false,
          isFutureChoice: false,
          charactersHere: [],
          source: "lorebook",
        });
      }
    });

    // B. Parse Universe Setting
    if (gameState.universeSetting?.loreFacts && Array.isArray(gameState.universeSetting.loreFacts)) {
      gameState.universeSetting.loreFacts.forEach((fact, idx) => {
        const id = `univ_loc_${idx}`;
        if (fact && fact.length > 5 && !locMap.has(fact.toLowerCase().trim())) {
          locMap.set(fact.toLowerCase().trim(), {
            id,
            name: fact.slice(0, 32),
            description: fact,
            category: "region",
            dangerLevel: 2,
            visitedSteps: [],
            isCurrentLocation: false,
            isPastVisited: false,
            isFutureChoice: false,
            charactersHere: [],
            source: "universe_setting",
          });
        }
      });
    }

    // C. Fallback to default canon locations if map is sparsely populated
    if (locMap.size < 3) {
      const defaults = generateDefaultWorldLocations(gameState.story.genre, gameState.story.title);
      defaults.forEach((d) => {
        locMap.set(d.name.toLowerCase().trim(), d);
      });
    }

    // D. Analyze PAST CHAPTERS & STEPS (Journey Trail)
    const visitedTrail: string[] = [];
    const allSteps = [
      ...(gameState.memoryChapters || []).map((m) => ({ step: m.chapterNumber, text: m.summary + " " + m.title })),
      ...(gameState.history || []).map((h) => ({ step: h.stepNumber, text: h.sceneText + " " + (h.action || "") })),
    ];

    // Detect which locations were mentioned in which step
    locMap.forEach((loc, key) => {
      allSteps.forEach((s) => {
        if (s.text.toLowerCase().includes(key)) {
          if (!loc.visitedSteps.includes(s.step)) {
            loc.visitedSteps.push(s.step);
          }
          loc.isPastVisited = true;
        }
      });
      // Sort visited steps chronologically
      loc.visitedSteps.sort((a, b) => a - b);
    });

    // Determine current location from current scene text
    let detectedCurrentId = "";
    const curSceneLower = (gameState.currentScene || "").toLowerCase();
    locMap.forEach((loc, key) => {
      if (curSceneLower.includes(key)) {
        loc.isCurrentLocation = true;
        loc.isPastVisited = true;
        detectedCurrentId = loc.id;
      }
    });

    // If none detected, pick the first visited or first in list as current
    if (!detectedCurrentId) {
      const firstLoc = Array.from(locMap.values())[0];
      if (firstLoc) {
        firstLoc.isCurrentLocation = true;
        firstLoc.isPastVisited = true;
        detectedCurrentId = firstLoc.id;
      }
    }

    // Associate characters with locations if mentioned together
    (gameState.characters || []).forEach((char) => {
      const charNameLower = (char.name || "").toLowerCase();
      locMap.forEach((loc) => {
        if (
          loc.description.toLowerCase().includes(charNameLower) ||
          (loc.isCurrentLocation && curSceneLower.includes(charNameLower))
        ) {
          if (!loc.charactersHere.includes(char.name)) {
            loc.charactersHere.push(char.name);
          }
        }
      });
    });

    // E. Analyze FUTURE PATHS from current choices
    (gameState.currentChoices || []).forEach((choice) => {
      const choiceTextLower = (choice.label + " " + (choice.description || "")).toLowerCase();
      locMap.forEach((loc, key) => {
        if (choiceTextLower.includes(key) && !loc.isCurrentLocation) {
          loc.isFutureChoice = true;
          loc.choiceLabel = choice.label;

          // Connect current location to this future choice
          if (detectedCurrentId) {
            links.push({
              id: `link_future_${detectedCurrentId}_${loc.id}`,
              source: detectedCurrentId,
              target: loc.id,
              type: "future_choice",
              name: choice.label,
            });
          }
        }
      });
    });

    // F. Create PAST JOURNEY LINKS (connecting visited nodes chronologically)
    const sortedVisited = Array.from(locMap.values())
      .filter((l) => l.visitedSteps.length > 0)
      .sort((a, b) => (a.visitedSteps[0] || 0) - (b.visitedSteps[0] || 0));

    for (let i = 0; i < sortedVisited.length - 1; i++) {
      links.push({
        id: `link_past_${sortedVisited[i].id}_${sortedVisited[i + 1].id}`,
        source: sortedVisited[i].id,
        target: sortedVisited[i + 1].id,
        type: "journey_past",
        name: `Путь из шага #${sortedVisited[i].visitedSteps[0]} в #${sortedVisited[i + 1].visitedSteps[0]}`,
      });
    }

    // G. Create CANON ROADS between adjacent locations
    const locArray = Array.from(locMap.values());
    for (let i = 0; i < locArray.length; i++) {
      const nextIdx = (i + 1) % locArray.length;
      if (locArray.length > 2) {
        const linkId = `link_canon_${locArray[i].id}_${locArray[nextIdx].id}`;
        if (!links.some((l) => l.id === linkId)) {
          links.push({
            id: linkId,
            source: locArray[i].id,
            target: locArray[nextIdx].id,
            type: "road",
            name: "Торговый тракт",
          });
        }
      }
    }

    return {
      locations: Array.from(locMap.values()),
      connections: links,
      currentLocId: detectedCurrentId,
    };
  }, [gameState]);

  // Filter nodes and links based on selected mode
  const { filteredLocations, filteredConnections } = useMemo(() => {
    let locs = locations;
    let conns = connections;

    // Filter by Mode (3 separate modes or unified)
    if (activeMode === "canon") {
      // Canon world map: all canonical locations, canon roads
      locs = locations;
      conns = connections.filter((c) => c.type === "road" || c.type === "border" || c.type === "sea_route");
    } else if (activeMode === "past") {
      // Past journey only: visited nodes and past journey trails
      locs = locations.filter((l) => l.isPastVisited || l.isCurrentLocation);
      conns = connections.filter((c) => c.type === "journey_past");
    } else if (activeMode === "future") {
      // Future paths only: current location and future choices
      locs = locations.filter((l) => l.isCurrentLocation || l.isFutureChoice);
      conns = connections.filter((c) => c.type === "future_choice");
    } else {
      // "unified": show all layers together
      locs = locations;
      conns = connections;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      locs = locs.filter((l) => l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q));
    }

    // Category filter
    if (selectedCategory !== "all") {
      locs = locs.filter((l) => l.category === selectedCategory);
    }

    return { filteredLocations: locs, filteredConnections: conns };
  }, [locations, connections, activeMode, searchQuery, selectedCategory]);

  // 2. D3 FORCE SIMULATION & RENDERING
  useEffect(() => {
    if (!svgRef.current || filteredLocations.length === 0) return;

    const width = svgRef.current.clientWidth || 900;
    const height = svgRef.current.clientHeight || 600;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Definitions for markers and filters
    const defs = svg.append("defs");

    // Glow filter
    const glow = defs.append("filter").attr("id", "glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    glow.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "coloredBlur");
    const feMerge = glow.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Arrow markers
    defs.append("marker")
      .attr("id", "arrow-gold")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 22)
      .attr("refY", 5)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto-start-reverse")
      .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 z")
      .attr("fill", "#f59e0b");

    defs.append("marker")
      .attr("id", "arrow-purple")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 22)
      .attr("refY", 5)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto-start-reverse")
      .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 z")
      .attr("fill", "#c084fc");

    // Main Zoomable Container
    const g = svg.append("g").attr("class", "map-canvas");

    // Background cartographic grid
    const gridPattern = defs.append("pattern")
      .attr("id", "carto-grid")
      .attr("width", 50)
      .attr("height", 50)
      .attr("patternUnits", "userSpaceOnUse");

    gridPattern.append("path")
      .attr("d", "M 50 0 L 0 0 0 50")
      .attr("fill", "none")
      .attr("stroke", "rgba(168, 85, 247, 0.08)")
      .attr("stroke-width", "0.8");

    g.append("rect")
      .attr("x", -2000)
      .attr("y", -2000)
      .attr("width", 4000)
      .attr("height", 4000)
      .attr("fill", "url(#carto-grid)");

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 3.5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    // Center initially
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.95));

    // Deep clone nodes and links for d3 mutation
    const nodes = filteredLocations.map((d) => ({ ...d }));
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const validLinks = filteredConnections
      .filter((c) => {
        const sId = typeof c.source === "object" ? c.source.id : c.source;
        const tId = typeof c.target === "object" ? c.target.id : c.target;
        return nodeMap.has(sId) && nodeMap.has(tId);
      })
      .map((c) => ({
        ...c,
        source: typeof c.source === "object" ? c.source.id : c.source,
        target: typeof c.target === "object" ? c.target.id : c.target,
      }));

    // Setup Simulation
    const simulation = d3.forceSimulation<any>(nodes)
      .force(
        "link",
        d3.forceLink<any, any>(validLinks)
          .id((d) => d.id)
          .distance((d) => {
            if (d.type === "journey_past") return 110;
            if (d.type === "future_choice") return 140;
            return 160;
          })
      )
      .force("charge", d3.forceManyBody().strength(-380))
      .force("center", d3.forceCenter(0, 0))
      .force("collide", d3.forceCollide().radius(48));

    // Draw Links
    const linkGroup = g.append("g").attr("class", "links");
    const link = linkGroup
      .selectAll("line")
      .data(validLinks)
      .enter()
      .append("line")
      .attr("stroke", (d: any) => {
        if (d.type === "journey_past") return "#f59e0b"; // Gold past path
        if (d.type === "future_choice") return "#c084fc"; // Purple future path
        return "rgba(107, 114, 128, 0.35)"; // Canon road
      })
      .attr("stroke-width", (d: any) => {
        if (d.type === "journey_past") return 3.5;
        if (d.type === "future_choice") return 2.5;
        return 1.4;
      })
      .attr("stroke-dasharray", (d: any) => {
        if (d.type === "future_choice") return "6,4";
        if (d.type === "road") return "3,3";
        return "none";
      })
      .attr("marker-end", (d: any) => {
        if (d.type === "journey_past") return "url(#arrow-gold)";
        if (d.type === "future_choice") return "url(#arrow-purple)";
        return "none";
      })
      .style("filter", (d: any) => (d.type === "journey_past" ? "url(#glow)" : "none"));

    // Draw Nodes
    const nodeGroup = g.append("g").attr("class", "nodes");
    const node = nodeGroup
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node-item cursor-pointer")
      .on("click", (event, d: any) => {
        sound.playClick();
        setSelectedLocation(d);
      });

    // Outer Halo for Current Location
    node.each(function (d: any) {
      if (d.isCurrentLocation) {
        d3.select(this)
          .append("circle")
          .attr("r", 26)
          .attr("fill", "none")
          .attr("stroke", "#ec4899")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "4,3")
          .attr("class", "animate-spin");

        d3.select(this)
          .append("circle")
          .attr("r", 32)
          .attr("fill", "rgba(236, 72, 153, 0.15)")
          .style("filter", "url(#glow)");
      }
    });

    // Node Base Circle
    node.append("circle")
      .attr("r", (d: any) => (d.isCurrentLocation ? 20 : d.category === "capital" ? 18 : 14))
      .attr("fill", (d: any) => {
        if (d.isCurrentLocation) return "#ec4899";
        if (d.isPastVisited) return "#eab308";
        if (d.isFutureChoice) return "#a855f7";
        if (d.category === "capital") return "#6366f1";
        if (d.category === "dungeon") return "#ef4444";
        if (d.category === "wilds") return "#10b981";
        return "#3b82f6";
      })
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2)
      .style("filter", (d: any) => (d.isCurrentLocation || d.isPastVisited ? "url(#glow)" : "none"));

    // Category / Status Icons
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", (d: any) => (d.isCurrentLocation ? "13px" : "11px"))
      .text((d: any) => {
        if (d.isCurrentLocation) return "📍";
        if (d.category === "capital") return "👑";
        if (d.category === "dungeon") return "⚔️";
        if (d.category === "wilds") return "🌲";
        if (d.category === "sanctuary") return "🏛️";
        return "🏰";
      });

    // Node Labels
    node.append("text")
      .attr("dy", (d: any) => (d.isCurrentLocation ? 32 : 24))
      .attr("text-anchor", "middle")
      .attr("fill", "#f3f4f6")
      .attr("font-size", "11px")
      .attr("font-weight", (d: any) => (d.isCurrentLocation ? "700" : "600"))
      .text((d: any) => d.name)
      .style("text-shadow", "0 2px 4px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.8)");

    // Step badge for visited locations
    node.each(function (d: any) {
      if (d.visitedSteps && d.visitedSteps.length > 0) {
        d3.select(this)
          .append("rect")
          .attr("x", 12)
          .attr("y", -18)
          .attr("width", 22)
          .attr("height", 14)
          .attr("rx", 7)
          .attr("fill", "#ca8a04");

        d3.select(this)
          .append("text")
          .attr("x", 23)
          .attr("y", -9)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("fill", "#ffffff")
          .attr("font-size", "9px")
          .attr("font-weight", "bold")
          .text(`#${d.visitedSteps[0]}`);
      }
    });

    // Simulation tick handler
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [filteredLocations, filteredConnections, activeMode]);

  if (!isOpen && !isEmbeddedSection) return null;

  // Zoom control handlers
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    sound.playClick();
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.3);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    sound.playClick();
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.77);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    sound.playClick();
    const width = svgRef.current.clientWidth || 900;
    const height = svgRef.current.clientHeight || 600;
    d3.select(svgRef.current)
      .transition()
      .duration(400)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.95));
  };

  // Add new location to state & lorebook
  const handleCreateLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim()) return;

    sound.playChoice();
    if (onAddLorebookEntry) {
      onAddLorebookEntry({
        id: `lore_loc_${Date.now()}`,
        title: newLocName.trim(),
        description: newLocDesc.trim() || `Новая открытая локация региона: ${newLocName.trim()}`,
        category: "локация",
        discoveredAtStep: gameState.stepCount,
      });
    }

    setShowAddModal(false);
    setNewLocName("");
    setNewLocDesc("");
  };

  const content = (
    <div className="relative w-full h-full flex flex-col bg-neutral-950 text-neutral-100 overflow-hidden select-none">
      {/* Top Header & Mode Toolbar */}
      <div className="p-3 sm:p-4 border-b border-purple-900/40 bg-neutral-950/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-950/50">
            <Compass className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-neutral-100">
                Интерактивная Карта Мира
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 font-mono border border-amber-800">
                D3 Cartography
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              География {gameState.story.title}: канон мира, пройденные главы и развилки будущих путей
            </p>
          </div>
        </div>

        {/* 4 MODES SWITCHER (3 отдельно + слитно) */}
        <div className="flex items-center p-1 rounded-xl bg-neutral-900 border border-neutral-800 shadow-inner gap-1">
          <button
            onClick={() => {
              sound.playClick();
              setActiveMode("canon");
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeMode === "canon"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/60"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
            title="1. Каноничная карта: все регионы, столицы и тракты сеттинга"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">1. Канон мира</span>
            <span className="sm:hidden">Канон</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveMode("past");
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeMode === "past"
                ? "bg-amber-600 text-white shadow-md shadow-amber-950/60"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
            title="2. Пройденный маршрут: история перемещений героя по главам"
          >
            <Footprints className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">2. Пройденный путь</span>
            <span className="sm:hidden">Путь</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveMode("future");
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeMode === "future"
                ? "bg-purple-600 text-white shadow-md shadow-purple-950/60"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
            title="3. Будущие пути: возможные развилки и направления из выборов"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">3. Будущие пути</span>
            <span className="sm:hidden">Выборы</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveMode("unified");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeMode === "unified"
                ? "bg-gradient-to-r from-amber-600 via-purple-600 to-indigo-600 text-white shadow-md shadow-purple-950/80"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
            title="4. Единый атлас: совмещает все 3 слоя на единой интерактивной карте"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Слитно (Атлас)</span>
          </button>
        </div>

        {/* Right close button if modal */}
        {!isEmbeddedSection && (
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Map Viewport Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-[#0a0a0f]">
        {/* SVG Canvas for D3 */}
        <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Floating Search & Filter Bar */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 max-w-sm">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по карте..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-neutral-900/90 border border-neutral-800 focus:border-purple-500 text-xs text-neutral-100 placeholder-neutral-500 backdrop-blur-md outline-none w-48 shadow-lg transition-all"
            />
          </div>

          <button
            onClick={() => {
              sound.playClick();
              setShowAddModal(true);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-800/80 text-purple-200 text-xs font-semibold flex items-center gap-1 shadow-md transition-all active:scale-95"
            title="Добавить новую локацию на карту"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">+ Локация</span>
          </button>
        </div>

        {/* Floating Zoom & Camera Controls */}
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5 bg-neutral-900/80 border border-neutral-800/80 p-1 rounded-xl backdrop-blur-md shadow-xl">
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
            title="Приблизить"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
            title="Отдалить"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
            title="Центрировать карту"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Map Legend Overlay */}
        <div className="absolute left-3 bottom-3 z-10 p-2.5 rounded-xl bg-neutral-950/85 border border-neutral-800 text-[11px] text-neutral-300 backdrop-blur-md shadow-xl max-w-xs space-y-1.5 hidden sm:block">
          <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
            Легенда карты:
          </span>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shadow-[0_0_6px_#ec4899]" />
              Текущая позиция
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
              Пройденные шаги
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              Будущие развилки
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              Канон / Столицы
            </span>
          </div>
        </div>

        {/* Selected Location Dossier Drawer */}
        {selectedLocation && (
          <div className="absolute right-3 bottom-3 z-20 w-80 sm:w-96 rounded-2xl bg-neutral-950/95 border border-purple-900/60 shadow-2xl backdrop-blur-lg p-4 text-xs space-y-3 animate-fade-in">
            <div className="flex items-start justify-between gap-2 border-b border-neutral-800/80 pb-2.5">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold text-neutral-100">{selectedLocation.name}</span>
                  {selectedLocation.isCurrentLocation && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-700 font-bold animate-pulse">
                      Вы здесь
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-purple-300 font-mono capitalize">
                  Категория: {selectedLocation.category} • Опасность: {selectedLocation.dangerLevel}/5
                </span>
              </div>

              <button
                onClick={() => setSelectedLocation(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed font-story max-h-36 overflow-y-auto">
              {selectedLocation.description}
            </p>

            {/* Visited Steps History */}
            {selectedLocation.visitedSteps.length > 0 && (
              <div className="p-2 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300 space-y-1">
                <span className="font-semibold block">Посещено в главах:</span>
                <span className="font-mono text-amber-200">
                  Шаги #{selectedLocation.visitedSteps.join(", #")}
                </span>
              </div>
            )}

            {/* Characters Present */}
            {selectedLocation.charactersHere.length > 0 && (
              <div className="text-[11px] text-neutral-400 space-y-0.5">
                <span className="font-medium text-neutral-300">Персонажи в этой локации:</span>
                <div className="flex flex-wrap gap-1 pt-1">
                  {selectedLocation.charactersHere.map((c, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-lg bg-neutral-900 border border-neutral-800 text-purple-300 text-[10px]">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Direct Travel Action Button */}
            {onExecuteAction && !selectedLocation.isCurrentLocation && (
              <button
                onClick={() => {
                  sound.playChoice();
                  onExecuteAction(`Отправиться в ${selectedLocation.name} и исследовать окрестности`);
                  setSelectedLocation(null);
                  if (!isEmbeddedSection) onClose();
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-950/50 transition-all active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Отправиться сюда действием</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal to Add New Custom Location */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-purple-900/60 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h4 className="font-bold text-sm text-neutral-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-purple-400" />
                Нанести новую локацию на карту
              </h4>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLocation} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-neutral-300 font-medium">Название локации *</label>
                <input
                  type="text"
                  required
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  placeholder="Например: Забытый Остров Рун"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-300 font-medium">Категория</label>
                <select
                  value={newLocCat}
                  onChange={(e) => setNewLocCat(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 outline-none focus:border-purple-500"
                >
                  <option value="city">Город / Поселение</option>
                  <option value="capital">Столица / Замок</option>
                  <option value="wilds">Чаща / Пустошь / Горы</option>
                  <option value="dungeon">Подземелье / Руины</option>
                  <option value="sanctuary">Храм / Башня / Святилище</option>
                  <option value="region">Обширный Регион</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-300 font-medium">Лорное описание</label>
                <textarea
                  rows={3}
                  value={newLocDesc}
                  onChange={(e) => setNewLocDesc(e.target.value)}
                  placeholder="Опишите особенности, тайны и атмосферу этой локации..."
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-md"
              >
                Сохранить локацию на карту и в Лорбук
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // If embedded section (e.g. activeGameView === "map"), render directly
  if (isEmbeddedSection) {
    return <div className="w-full h-[calc(100vh-140px)] rounded-2xl overflow-hidden border border-purple-900/40 shadow-2xl">{content}</div>;
  }

  // Otherwise render full screen modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-6xl h-[88vh] rounded-3xl bg-neutral-950 border border-purple-900/60 shadow-2xl overflow-hidden">
        {content}
      </div>
    </div>
  );
};
