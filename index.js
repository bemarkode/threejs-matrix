import * as THREE from "https://unpkg.com/three@0.166.1/build/three.module.js";

const container = document.getElementById("container");

let scene, camera, renderer, instancedMesh, center, radius;
let rowLine, columnLine;
let rowLines, columnLines, yzPlane, crossingPoint;
let gridDimensions = null;
let distances;
let rowOffset, columnOffset;
let crossingSphere;

const gradientColors = [
    { color: new THREE.Color(0x00FFFF), position: 0 },    // Cyan
    { color: new THREE.Color(0xFF00FF), position: 1 }     // Magenta
];

async function init() {
    const points = await loadPoints("points_cleaned.txt");
    const smoothPoints = await loadPoints("original_points_cleaned.txt");
    setupScene(points, smoothPoints);
    createGridLines(points, 23, 26);
    createCrossingSphere(crossingPoint);
    setupScrollAnimation();
    
    distances = calculateDistances(points, smoothPoints);
    //const mappedColors = mapDistancesToColors(distances);
    //updateGeometryColors(mappedColors);
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

function setupScene(points, smoothPoints) {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        stencil: false,
        depth: true
    });
    
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(new THREE.Color(0x000000), 0); // background opacity 0
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    
    // Enable shadow mapping if you're using shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();
    container.appendChild(renderer.domElement);

    center = new THREE.Vector3();
    radius = 0;

    instancedMesh = createInstancedMesh(points, smoothPoints);
    scene.add(instancedMesh);

    calculateGridDimensions(points);
    yzPlane = createYZPlane(points);
    scene.add(yzPlane);

    adjustCamera();

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
    scene.add(hemisphereLight);

    window.addEventListener('resize', onWindowResize, false);

    animate();
}

function createInstancedMesh(points, smoothPoints) {
    // Calculate distances and sphere sizes
    const distances = calculateDistances(points, smoothPoints);
    const sphereSizes = calculateSphereSizes(distances);

    // Create a sphere geometry with a unit radius
    const sphereGeometry = new THREE.SphereGeometry(1, 16, 16);

    const material = new THREE.MeshStandardMaterial({
        vertexColors: false,
        metalness: 0.5,
        roughness: 0.2,
        emissive: 0x000000,
    });
    
    const instancedMesh = new THREE.InstancedMesh(sphereGeometry, material, points.length);
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color(1, 1, 1); // Start with white color

    points.forEach((point, i) => {
        const size = sphereSizes[i];
        matrix.makeScale(size, size, size);  // Scale the sphere
        matrix.setPosition(point);           // Set the position
        instancedMesh.setMatrixAt(i, matrix);
        instancedMesh.setColorAt(i, color);
        center.add(point);
    });

    center.divideScalar(points.length);
    points.forEach(point => {
        radius = Math.max(radius, center.distanceTo(point));
    });

    instancedMesh.userData = {
        startPositions: points,
        smoothPositions: smoothPoints,
        sphereSizes: sphereSizes
    };

    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.instanceColor.needsUpdate = true;

    return instancedMesh;
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
    colors.fill(1)
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.userData = { startPositions, smoothPositions };

    return geometry;
}

function calculateGridDimensions(points) {
    // If dimensions are already calculated, return the stored value
    if (gridDimensions) {
        return gridDimensions;
    }

    const gridSize = 101; // Assuming the grid is still 101x101
    
    try {
        // Calculate width (along x-axis)
        const firstRowStart = points[0];
        const firstRowEnd = points[gridSize - 1];
        const gridWidth = firstRowStart.distanceTo(firstRowEnd);
        
        // Calculate length (along z-axis)
        const firstColumnStart = points[0];
        const firstColumnEnd = points[(gridSize - 1) * gridSize];
        const gridLength = firstColumnStart.distanceTo(firstColumnEnd);

        // Store the calculated dimensions
        gridDimensions = { width: gridWidth, length: gridLength };
    } catch (error) {
        console.error("Error calculating grid dimensions:", error);
        // Set default values if calculation fails
        gridDimensions = { width: 5000, length: 5000 };
        console.log("Using default grid dimensions:", gridDimensions);
    }

    return gridDimensions;
}

function createYZPlane(points) {
    const { width, length } = gridDimensions;

    // Create a plane geometry
    const planeGeometry = new THREE.PlaneGeometry(width, width, 1, 32);  // Increased vertical segments for smoother gradient

    // Create custom shader material
    const planeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            colorBottom: { value: new THREE.Color(gradientColors[0].color) },
            colorTop: { value: new THREE.Color(gradientColors[gradientColors.length - 1].color) }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 colorBottom;
            uniform vec3 colorTop;
            varying vec2 vUv;
            void main() {
                vec3 color = mix(colorTop, colorBottom, vUv.x);
                float opacity = sin(vUv.x * 3.14159);
                gl_FragColor = vec4(color, opacity * 0.5);  // Adjust the 0.5 to control overall opacity
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });

    // Create the plane mesh
    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);

    // Position the plane
    planeMesh.position.set(points[0].x, center.y, center.z);
    planeMesh.rotation.y = Math.PI / 2;

    return planeMesh;
}

function adjustCamera() {
    camera.position.set(center.x, center.y - radius, center.z + radius / 4);
    camera.lookAt(center);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    if (instancedMesh) {
        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.instanceColor.needsUpdate = true;
    }
    if (yzPlane) yzPlane.position.needsUpdate = true;
    if (crossingSphere) crossingSphere.material.needsUpdate = true;
}

function createGridLines(points, rowIndex, columnIndex) {
    const gridSize = 101;
    crossingPoint = new THREE.Vector3(
        points[rowIndex * gridSize + columnIndex].x,
        points[rowIndex * gridSize + columnIndex].y,
        points[rowIndex * gridSize + columnIndex].z
    );

    // Create row lines
    const rowPoints = points.slice(rowIndex * gridSize, (rowIndex + 1) * gridSize);
    rowLines = [
        createLine(rowPoints.slice(0, columnIndex + 1), 0xff0000),
        createLine(rowPoints.slice(columnIndex).reverse(), 0xff0000)
    ];

    // Create column lines
    const columnPoints = [];
    for (let i = 0; i < gridSize; i++) {
        columnPoints.push(points[i * gridSize + columnIndex]);
    }
    columnLines = [
        createLine(columnPoints.slice(0, rowIndex + 1), 0x00ff00),
        createLine(columnPoints.slice(rowIndex).reverse(), 0x00ff00)
    ];

    // Add lines to the scene
    rowLines.forEach(line => scene.add(line));
    columnLines.forEach(line => scene.add(line));
    rowOffset = gridSize - rowIndex;
    columnOffset = gridSize - columnIndex;

}

function createLine(points, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geometry, material);
    line.geometry.setDrawRange(0, 0);
    return line;
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
            return containerRect.top + containerRect.height + window.innerHeight + 5000;
        },
        scrub: true,
        pin: true,
        anticipatePin: 0,
        onUpdate: self => {
            const progress = self.progress;
            animateInChunks(progress);
        },
    });
}

function animateInChunks(progress) {
    const numChunks = 4; // Increased to 4 chunks
    const chunkSize = 1 / numChunks;

    if (progress < chunkSize) {
        const planeProgress = progress / chunkSize;
        animatePlaneMovement(planeProgress);
    } else if (progress < chunkSize * 2) {
        // First chunk: Animate grid lines
        const lineProgress = (progress - chunkSize) / chunkSize;
        animateGridLines(lineProgress);
    } else if (progress < chunkSize * 3) {
        // Ensure grid lines are fully drawn
        animateGridLines(1);
        // New chunk: Animate crossing sphere
        const sphereProgress = (progress - chunkSize * 2) / chunkSize;
        animateCrossingSphere(sphereProgress);
    } else {
        // Last chunk: Animate points transition
        const pointProgress = (progress - chunkSize * 3) / chunkSize;
        animatePointsTransition(pointProgress);
    }
}

function animatePlaneMovement(progress) {
    if (!yzPlane) {
        console.log("YZ Plane not initialized");
        return;
    }

    const { width, length } = gridDimensions;
    const { startPositions } = instancedMesh.userData;
    const startX = startPositions[0].x;
    const endX = startX + length;  // Use the actual grid width

    const newX = lerp(startX, endX, progress);

    yzPlane.position.setX(newX);
    yzPlane.updateMatrix();
    
    updatePointColors(newX);
}

function animateGridLines(progress) {
    const totalPoints = 101;

    function animateLine(line, maxPoints) {
        const pointsToDraw = lerp(0, maxPoints, progress);                 
        line.geometry.setDrawRange(0, pointsToDraw);
    }

        animateLine(rowLines[0], totalPoints - rowOffset);
        animateLine(rowLines[1], totalPoints);
        animateLine(columnLines[0], totalPoints - columnOffset);
        animateLine(columnLines[1], totalPoints);
}

function animateCrossingSphere(progress) {
    if (!crossingSphere) {
        createCrossingSphere();
    }

    const maxSize = 10;
    const maxHeight = 1000;
    
    // Grow in size
    const size = Math.min(progress * 2, 1) * maxSize;
    crossingSphere.scale.set(size, size, size);
    
    // Move up
    const height = Math.max(0, (progress - 0.5) * 2) * maxHeight;
    crossingSphere.position.z = crossingPoint.z + height;
    
    // Turn to red
    const color = new THREE.Color().setHSL(0, 1, 0.5).lerp(new THREE.Color(1, 0, 0), Math.max(0, (progress - 0.75) * 4));
    crossingSphere.material.color.copy(color);
    
    // Fade out at the end
    crossingSphere.material.opacity = progress < 0.9 ? 1 : 1 - ((progress - 0.9) * 10);
    crossingSphere.material.transparent = progress > 0.9;
}

function createCrossingSphere() {
    const geometry = new THREE.SphereGeometry(10, 32, 32);
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.5,
        roughness: 0.2,
    });
    crossingSphere = new THREE.Mesh(geometry, material);
    crossingSphere.position.copy(crossingPoint);
    crossingSphere.scale.set(0, 0, 0); // Start with zero scale
    scene.add(crossingSphere);
}

function animatePointsTransition(progress) {
    const { startPositions, smoothPositions, sphereSizes } = instancedMesh.userData;
    const matrix = new THREE.Matrix4();

    // Calculate distances from crossing point
    const distancesFromCrossing = startPositions.map(pos => pos.distanceTo(crossingPoint));
    const maxDistanceFromCrossing = Math.max(...distancesFromCrossing);
    const maxDistance = Math.max(...distances);

    const minSize = 10;  // Minimum sphere size

    for (let i = 0; i < instancedMesh.count; i++) {
        const startPos = startPositions[i];
        const smoothPos = smoothPositions[i];
        const initialSize = sphereSizes[i];
        const pointDistance = startPos.distanceTo(smoothPos);

        // Calculate start and end times for each sphere
        const distanceRatio = distancesFromCrossing[i] / maxDistanceFromCrossing;
        const startTime = distanceRatio * 1; // Adjust this multiplier to control stagger amount
        const endTime = 1 - (1 - distanceRatio) * 0.75; // Adjust this to control end time stagger

        // Calculate local progress for this sphere
        let localProgress;
        if (progress < startTime) {
            localProgress = 0;
        } else if (progress > endTime) {
            localProgress = 1;
        } else {
            localProgress = (progress - startTime) / (endTime - startTime);
        }

        // Ease the local progress if desired
        // localProgress = easeInOutCubic(localProgress);

        const newPos = new THREE.Vector3().lerpVectors(startPos, smoothPos, localProgress);
        
        // Calculate the new size
        const newSize = lerp(initialSize, minSize, localProgress);
        
        matrix.makeScale(newSize, newSize, newSize);  // Set the new scale
        matrix.setPosition(newPos);          // Set the position
        instancedMesh.setMatrixAt(i, matrix);

        // Calculate color based on distance and overall animation progress
        const colorProgress = pointDistance / maxDistance;
        const startColor = lerpColor(gradientColors[0].color, gradientColors[1].color, colorProgress);
        const endColor = new THREE.Color(0x00FFFF);
        const finalColor = lerpColor(startColor, endColor, localProgress);
        
        instancedMesh.setColorAt(i, finalColor);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.instanceColor.needsUpdate = true;
}

function calculateDistances(points, smoothPoints) {
    if (points.length !== smoothPoints.length) {
        console.error("The number of points and smoothPoints must be the same.");
        return [];
    }

    return points.map((point, i) => point.distanceTo(smoothPoints[i]));
}

function calculateSphereSizes(distances) {
    const minDistance = Math.min(...distances);
    const maxDistance = Math.max(...distances);
    const minSize = 10;  // Minimum sphere size
    const maxSize = 25; // Maximum sphere size

    return distances.map(distance => {
        const t = (distance - minDistance) / (maxDistance - minDistance);
        return minSize + t * (maxSize - minSize);
    });
}

function lerpColor(colorA, colorB, t) {
    return new THREE.Color(
        colorA.r + (colorB.r - colorA.r) * t,
        colorA.g + (colorB.g - colorA.g) * t,
        colorA.b + (colorB.b - colorA.b) * t
    );
}

function updatePointColors(planePosition) {
    const minDistance = Math.min(...distances);
    const maxDistance = Math.max(...distances);
    const { startPositions } = instancedMesh.userData;

    for (let i = 0; i < instancedMesh.count; i++) {
        if (startPositions[i].x <= planePosition) {
            const color = mapDistanceToCustomGradient(distances[i], minDistance, maxDistance);
            instancedMesh.setColorAt(i, color);
        } else {
            instancedMesh.setColorAt(i, new THREE.Color(1, 1, 1)); // White for spheres not yet reached
        }
    }

    instancedMesh.instanceColor.needsUpdate = true;

    // Log the first few colors after update for debugging
    for (let i = 0; i < 5; i++) {
        const color = new THREE.Color();
        instancedMesh.getColorAt(i, color);
    }
}

function mapDistanceToCustomGradient(distance, minDistance, maxDistance) {
    const t = (distance - minDistance) / (maxDistance - minDistance);
    
    // Find the two colors to interpolate between
    let colorA, colorB, positionA, positionB;
    for (let i = 0; i < gradientColors.length - 1; i++) {
        if (t >= gradientColors[i].position && t <= gradientColors[i + 1].position) {
            colorA = gradientColors[i].color;
            colorB = gradientColors[i + 1].color;
            positionA = gradientColors[i].position;
            positionB = gradientColors[i + 1].position;
            break;
        }
    }
    
    // If t is exactly 1 or we didn't find a segment (shouldn't happen with proper gradient definition)
    if (t === 1 || !colorA) {
        return gradientColors[gradientColors.length - 1].color;
    }
    
    // Interpolate between the two colors
    const segmentT = (t - positionA) / (positionB - positionA);
    return lerpColor(colorA, colorB, segmentT);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

init();