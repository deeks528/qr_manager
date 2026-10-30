import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Pressable,
  LayoutChangeEvent,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { QuickMessage } from '@domain/models/QuickMessage';

interface DraggableQuickMessagesListProps {
  messages: QuickMessage[];
  onReorder: (newOrderIds: string[]) => void;
  onEdit: (message: QuickMessage) => void;
  onDelete: (id: string) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

interface DraggableRowProps {
  msg: QuickMessage;
  index: number;
  totalCount: number;
  isDragging: boolean;
  isAnyDragging: boolean;
  animY: Animated.Value;
  activeScale: Animated.Value;
  onRowDragStart: (index: number) => void;
  onRowDragMove: (dy: number) => void;
  onRowDragRelease: () => void;
  onEdit: (msg: QuickMessage) => void;
  onDelete: (id: string) => void;
  onLayout?: (e: LayoutChangeEvent) => void;
}

function GripDots({ active }: { active: boolean }) {
  return (
    <View style={styles.gripContainer}>
      <View style={styles.gripCol}>
        <View style={[styles.gripDot, active && styles.gripDotActive]} />
        <View style={[styles.gripDot, active && styles.gripDotActive]} />
        <View style={[styles.gripDot, active && styles.gripDotActive]} />
      </View>
      <View style={styles.gripCol}>
        <View style={[styles.gripDot, active && styles.gripDotActive]} />
        <View style={[styles.gripDot, active && styles.gripDotActive]} />
        <View style={[styles.gripDot, active && styles.gripDotActive]} />
      </View>
    </View>
  );
}

function DraggableRow({
  msg,
  index,
  totalCount,
  isDragging,
  isAnyDragging,
  animY,
  activeScale,
  onRowDragStart,
  onRowDragMove,
  onRowDragRelease,
  onEdit,
  onDelete,
  onLayout,
}: DraggableRowProps) {
  const indexRef = useRef(index);
  indexRef.current = index;

  const onRowDragStartRef = useRef(onRowDragStart);
  onRowDragStartRef.current = onRowDragStart;

  const onRowDragMoveRef = useRef(onRowDragMove);
  onRowDragMoveRef.current = onRowDragMove;

  const onRowDragReleaseRef = useRef(onRowDragRelease);
  onRowDragReleaseRef.current = onRowDragRelease;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
        onPanResponderGrant: () => {
          onRowDragStartRef.current(indexRef.current);
        },
        onPanResponderMove: (_, gesture) => {
          onRowDragMoveRef.current(gesture.dy);
        },
        onPanResponderRelease: () => {
          onRowDragReleaseRef.current();
        },
        onPanResponderTerminate: () => {
          onRowDragReleaseRef.current();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );

  const isLast = index === totalCount - 1;

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.rowContainer,
        isLast && !isDragging && { borderBottomWidth: 0 },
        isDragging && styles.rowDragging,
        {
          transform: [{ translateY: animY }, { scale: isDragging ? activeScale : 1 }],
          zIndex: isDragging ? 999 : 1,
          elevation: isDragging ? 10 : 0,
        },
      ]}
    >
      {/* 6-dot drag handle */}
      <View
        {...panResponder.panHandlers}
        accessibilityHint="Drag up or down to reorder this message"
        accessibilityLabel={`Drag handle for ${msg.text}`}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.dragHandle}
      >
        <GripDots active={isDragging} />
      </View>

      {/* Message Info */}
      <View style={styles.textContainer}>
        <Text numberOfLines={1} style={styles.messageTitle}>
          {msg.text}
        </Text>
        <Text style={styles.messageSubtitle}>Quick pay note</Text>
      </View>

      {/* Edit & Delete Action Icons */}
      <View style={styles.actionContainer}>
        <Pressable
          accessibilityLabel={`Edit ${msg.text}`}
          disabled={isAnyDragging}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          onPress={() => onEdit(msg)}
          style={[styles.actionBtn, isAnyDragging && styles.actionBtnDisabled]}
        >
          <Ionicons color="#64748B" name="pencil-outline" size={17} />
        </Pressable>
        <Pressable
          accessibilityLabel={`Delete ${msg.text}`}
          disabled={isAnyDragging}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          onPress={() => onDelete(msg.id)}
          style={[styles.actionBtn, isAnyDragging && styles.actionBtnDisabled]}
        >
          <Ionicons color="#EF4444" name="trash-outline" size={17} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function DraggableQuickMessagesList({
  messages,
  onReorder,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
}: DraggableQuickMessagesListProps) {
  const [items, setItems] = useState<QuickMessage[]>(messages);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const draggedIndexRef = useRef<number | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  const rowHeightRef = useRef<number>(68);

  const dragTranslateY = useRef(new Animated.Value(0)).current;
  const activeScale = useRef(new Animated.Value(1)).current;
  const itemOffsetsRef = useRef<Animated.Value[]>([]);

  // Keep itemOffsets aligned with items count
  while (itemOffsetsRef.current.length < items.length) {
    itemOffsetsRef.current.push(new Animated.Value(0));
  }

  // Synchronize when external messages change and not currently dragging
  useEffect(() => {
    if (draggedIndexRef.current === null) {
      setItems(messages);
    }
  }, [messages]);

  const handleRowLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h && Math.abs(h - rowHeightRef.current) > 1) {
      rowHeightRef.current = h;
    }
  };

  const handleRowDragStart = (startIndex: number) => {
    draggedIndexRef.current = startIndex;
    hoverIndexRef.current = startIndex;
    setDraggedIndex(startIndex);
    onDragStart?.();

    dragTranslateY.setValue(0);
    Animated.spring(activeScale, {
      toValue: 1.025,
      friction: 7,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  const handleRowDragMove = (dy: number) => {
    const startIndex = draggedIndexRef.current;
    if (startIndex === null) return;

    dragTranslateY.setValue(dy);

    const h = rowHeightRef.current || 68;
    const slotOffset = Math.round(dy / h);
    const targetIndex = Math.max(0, Math.min(items.length - 1, startIndex + slotOffset));

    if (targetIndex !== hoverIndexRef.current) {
      hoverIndexRef.current = targetIndex;

      for (let k = 0; k < items.length; k++) {
        if (k === startIndex) continue;

        let targetOffset = 0;
        if (startIndex < targetIndex) {
          if (k > startIndex && k <= targetIndex) {
            targetOffset = -h;
          }
        } else if (startIndex > targetIndex) {
          if (k >= targetIndex && k < startIndex) {
            targetOffset = h;
          }
        }

        const anim = itemOffsetsRef.current[k];
        if (anim) {
          Animated.spring(anim, {
            toValue: targetOffset,
            friction: 8,
            tension: 70,
            useNativeDriver: true,
          }).start();
        }
      }
    }
  };

  const handleRowDragRelease = () => {
    const startIndex = draggedIndexRef.current;
    const targetIndex = hoverIndexRef.current;

    if (startIndex === null || targetIndex === null) {
      setDraggedIndex(null);
      draggedIndexRef.current = null;
      hoverIndexRef.current = null;
      onDragEnd?.();
      return;
    }

    const h = rowHeightRef.current || 68;
    const dropTranslateY = (targetIndex - startIndex) * h;

    Animated.parallel([
      Animated.spring(dragTranslateY, {
        toValue: dropTranslateY,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.spring(activeScale, {
        toValue: 1,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (targetIndex !== startIndex) {
        const nextItems = [...items];
        const [moved] = nextItems.splice(startIndex, 1);
        nextItems.splice(targetIndex, 0, moved);
        setItems(nextItems);
        onReorder(nextItems.map((m) => m.id));
      }

      dragTranslateY.setValue(0);
      itemOffsetsRef.current.forEach((v) => v.setValue(0));
      draggedIndexRef.current = null;
      hoverIndexRef.current = null;
      setDraggedIndex(null);
      onDragEnd?.();
    });
  };

  return (
    <View style={styles.listContainer}>
      {items.map((msg, index) => {
        const isDragging = draggedIndex === index;
        const animY = isDragging
          ? dragTranslateY
          : itemOffsetsRef.current[index] || new Animated.Value(0);

        return (
          <DraggableRow
            key={msg.id}
            activeScale={activeScale}
            animY={animY}
            index={index}
            isAnyDragging={draggedIndex !== null}
            isDragging={isDragging}
            msg={msg}
            onDelete={onDelete}
            onEdit={onEdit}
            onLayout={index === 0 ? handleRowLayout : undefined}
            onRowDragMove={handleRowDragMove}
            onRowDragRelease={handleRowDragRelease}
            onRowDragStart={handleRowDragStart}
            totalCount={items.length}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    width: '100%',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  rowDragging: {
    backgroundColor: '#F8FAFC',
    borderColor: '#0D9488',
    borderWidth: 1.5,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  dragHandle: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gripContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gripCol: {
    flexDirection: 'column',
    marginHorizontal: 1.5,
  },
  gripDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#94A3B8',
    marginVertical: 1.5,
  },
  gripDotActive: {
    backgroundColor: '#0D9488',
  },
  textContainer: {
    flex: 1,
    marginLeft: 4,
    justifyContent: 'center',
  },
  messageTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  messageSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionBtn: {
    padding: 6,
    marginLeft: 4,
  },
  actionBtnDisabled: {
    opacity: 0.3,
  },
});
