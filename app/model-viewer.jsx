"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Center, ContactShadows, OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { BoxHelper, LoopRepeat } from "three";

function Station({ url, playing, speed, fault, replay, scrubbing, highlightName, onComponentClick }) {
  const { scene: loadedScene, animations } = useGLTF(url);
  const scene = useMemo(() => loadedScene.clone(true), [loadedScene]);
  const group = useRef();
  const highlightHelper = useRef();
  const { actions } = useAnimations(animations, group);

  useEffect(() => () => {
    if (!highlightHelper.current) return;
    scene.remove(highlightHelper.current);
    highlightHelper.current.geometry.dispose();
    highlightHelper.current.material.dispose();
    highlightHelper.current = null;
  }, [scene]);

  useEffect(() => {
    const activeActions = Object.values(actions).filter(Boolean);
    activeActions.forEach((action) => {
      action.timeScale = speed;
      action.setLoop(LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      action.enabled = true;
      if (playing && !scrubbing) {
        action.paused = false;
        if (!action.isRunning()) action.reset().fadeIn(0.25).play();
      } else {
        // A paused action must stay active so replay can seek all of the
        // model's linked tracks to the same instant.
        if (!action.isRunning()) action.play();
        action.paused = true;
      }
    });
  }, [actions, playing, speed, scrubbing]);

  useEffect(() => () => {
    Object.values(actions).filter(Boolean).forEach((action) => action.stop());
  }, [actions]);

  useEffect(() => {
    const previousHelper = highlightHelper.current;
    if (previousHelper) {
      scene.remove(previousHelper);
      previousHelper.geometry.dispose();
      previousHelper.material.dispose();
      highlightHelper.current = null;
    }
    if (!highlightName) return undefined;
    let target = null;
    scene.traverse((object) => {
      if (!target && object.name.toLowerCase().includes(highlightName.toLowerCase())) target = object;
    });
    if (!target) return undefined;
    const helper = new BoxHelper(target, "#d8ff5e");
    helper.material.transparent = true;
    helper.material.opacity = 0.96;
    helper.material.depthTest = false;
    helper.renderOrder = 10;
    scene.add(helper);
    highlightHelper.current = helper;
    return () => {
      scene.remove(helper);
      helper.geometry.dispose();
      helper.material.dispose();
      if (highlightHelper.current === helper) highlightHelper.current = null;
    };
  }, [highlightName, scene]);

  useFrame(({ clock }, delta) => {
    const root = group.current;
    if (!root) return;
    highlightHelper.current?.update();
    const beam = root.getObjectByName("Visible red laser beam");
    const scanLine = root.getObjectByName("Red line laser on fin crest");
    if (beam && scanLine) {
      const glow = playing ? (fault ? 0.74 + Math.sin(clock.elapsedTime * 12) * 0.2 : 0.94 + Math.sin(clock.elapsedTime * 7) * 0.06) : 0.92;
      beam.scale.x = glow;
      beam.scale.y = glow;
      scanLine.scale.y = glow;
    }

  });

  return <Center><group ref={group} rotation={[0, -0.23, 0]}><primitive object={scene} onClick={(event) => { event.stopPropagation(); onComponentClick?.(event.object.name); }} /></group></Center>;
}

export default function ModelViewer({ source, accent, playing, speed, fault, replay, scrubbing, highlightName, onComponentClick }) {
  return <Canvas camera={{ position: [23, 15, 29], fov: 29 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
    <color attach="background" args={["#071117"]} />
    <fog attach="fog" args={["#071117", 28, 66]} />
    <ambientLight intensity={0.58} />
    <hemisphereLight args={["#bfefff", "#071019", 1.35]} />
    <directionalLight position={[8, 13, 7]} intensity={2.35} color="#effdff" />
    <directionalLight position={[-11, 5, -8]} intensity={1.2} color={accent} />
    <pointLight position={[0, 4, 5]} intensity={9} color={accent} distance={21} decay={2} />
    <Suspense fallback={null}><Station url={source} playing={playing} speed={speed} fault={fault} replay={replay} scrubbing={scrubbing} highlightName={highlightName} onComponentClick={onComponentClick} /></Suspense>
    <ContactShadows position={[0, -5.4, 0]} opacity={0.58} scale={44} blur={2.4} far={14} color="#010609" />
    <OrbitControls makeDefault enablePan={false} minDistance={20} maxDistance={51} minPolarAngle={0.68} maxPolarAngle={1.6} autoRotate={false} />
  </Canvas>;
}
