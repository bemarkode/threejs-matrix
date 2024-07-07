import * as THREE from "https://unpkg.com/three@0.112/build/three.module.js";

const container = document.getElementById("container");

let scene, camera, renderer, particleSystem, center, radius;
let rowLine, columnLine;

async function init() {
    const points = await loadPoints("points_cleaned.txt");
    const smoothPoints = await loadPoints("original_points_cleaned.txt");

    setupScene(points, smoothPoints);
    createGridLines(points, 23, 26);
    setupScrollAnimation();
    
    const distances = calculateDistances(points, smoothPoints);
    const mappedColors = mapDistancesToColors(distances);
    updateGeometryColors(mappedColors);
}

async function loadPoints(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.text();
        return data.split("\n").map(line => {
            const values = line.split(",").map(parseFloat);
            return new THREE.Vector3(values[0], values[1], values[2]);
        });
    } catch (error) {
        console.error(`Error loading points from ${url}:`, error);
    }
}

function calculateDistances(points, smoothPoints) {
    if (points.length !== smoothPoints.length) {
        console.error("The number of points and smoothPoints must be the same.");
        return [];
    }

    return points.map((point, i) => point.distanceTo(smoothPoints[i]));
}

function mapDistancesToColors(distances) {
    const maxDistance = Math.max(...distances);
    const minDistance = Math.min(...distances);
    return distances.map(distance => {
        const normalizedDistance = (distance - minDistance) / (maxDistance - minDistance);
        const hue = (1 - normalizedDistance) * 0.6; // Map 0-1 to 0.6-0 (cyan to red)
        return new THREE.Color().setHSL(hue, 1, 0.5);
    });
}

function updateGeometryColors(colors) {
    const colorAttribute = particleSystem.geometry.getAttribute('color');
    colors.forEach((color, i) => {
        colorAttribute.setXYZ(i, color.r, color.g, color.b);
    });
    colorAttribute.needsUpdate = true;
}

function setupScene(points, smoothPoints) {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();
    container.appendChild(renderer.domElement);

    center = new THREE.Vector3();
    radius = 0;

    const geometry = createGeometry(points, smoothPoints);
    const material = new THREE.PointsMaterial({ size: 3, vertexColors: true });
    particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    adjustCamera();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);

    window.addEventListener('resize', onWindowResize, false);

    animate();
}

function createGeometry(points, smoothPoints) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    const smoothPositions = new Float32Array(smoothPoints.length * 3);
    const startPositions = new Float32Array(points.length * 3);

    points.forEach((point, i) => {
        positions[i * 3] = point.x;
        positions[i * 3 + 1] = point.y;
        positions[i * 3 + 2] = point.z;
        smoothPositions[i * 3] = smoothPoints[i].x;
        smoothPositions[i * 3 + 1] = smoothPoints[i].y;
        smoothPositions[i * 3 + 2] = smoothPoints[i].z;
        startPositions[i * 3] = points[i].x;
        startPositions[i * 3 + 1] = points[i].y;
        startPositions[i * 3 + 2] = points[i].z;
        center.add(point);
    });

    center.divideScalar(points.length);
    points.forEach(point => {
        radius = Math.max(radius, center.distanceTo(point));
    });

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const colors = new Float32Array(points.length * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.userData = { startPositions, smoothPositions };

    return geometry;
}

function adjustCamera() {
    camera.position.set(center.x, center.y - radius, center.z + radius / 4);
    camera.lookAt(center);
}

function createGridLines(points, rowIndex, columnIndex) {
    const gridSize = 101;

    rowLine = createLine(points.slice(rowIndex * gridSize, (rowIndex + 1) * gridSize), 0xff0000);
    scene.add(rowLine);

    const columnPoints = [];
    for (let i = 0; i < gridSize; i++) {
        columnPoints.push(points[i * gridSize + columnIndex]);
    }
    columnLine = createLine(columnPoints, 0x00ff00);
    scene.add(columnLine);
}

function createLine(points, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geometry, material);
    line.geometry.setDrawRange(0, 0);
    line.scale.z = 0.01;
    return line;
}

function animateGridLines(progress) {
    const totalPoints = 101;
    const pointsToDraw = Math.floor(progress * totalPoints);

    if (rowLine && columnLine) {
        rowLine.geometry.setDrawRange(0, pointsToDraw);
        columnLine.geometry.setDrawRange(0, pointsToDraw);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function setupScrollAnimation() {
    gsap.registerPlugin(ScrollTrigger);

    ScrollTrigger.create({
        trigger: container,
        start: () => {
            const containerRect = container.getBoundingClientRect();
            return containerRect.top + containerRect.height - window.innerHeight;
        },
        end: () => {
            const containerRect = container.getBoundingClientRect();
            return containerRect.top + containerRect.height + window.innerHeight;
        },
        scrub: true,
        pin: true,
        anticipatePin: 0,
        onUpdate: self => {
            const progress = self.progress;
            console.log("Progress:", progress);
            animatePointsTransition(progress);
            animateGridLines(progress);
        },
    });
}

function animatePointsTransition(progress) {
    const positions = particleSystem.geometry.attributes.position.array;
    const { startPositions, smoothPositions } = particleSystem.geometry.userData;

    // Use an easing function to make the transition smoother
    const easedProgress = easeInOutCubic(progress);

    for (let i = 0; i < positions.length; i++) {
        // Interpolate between smooth and start positions
        positions[i] = lerp(startPositions[i], smoothPositions[i], easedProgress);
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
}

// Cubic easing function
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Linear interpolation function
function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    particleSystem.geometry.attributes.position.needsUpdate = true;
}

init();
