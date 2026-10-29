import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

/**
 * Viewer 3D estilo "Workbench" do Blender: luz chapada, sem sombras,
 * navegação por órbita. Pensado para mostrar um .fbx + textura para o cliente.
 */
export class Viewer {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private currentModel: THREE.Object3D | null = null
  private wireframe = false
  private autoRotate = false
  private backfaceCulling = true
  private grid: THREE.GridHelper
  private onStatsChange: (stats: { tris: number; objects: number }) => void

  constructor(canvas: HTMLCanvasElement, onStatsChange: (stats: { tris: number; objects: number }) => void) {
    this.onStatsChange = onStatsChange

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x2b2b2b)

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 1000)
    this.camera.position.set(3, 2, 4)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 0.1
    this.controls.maxDistance = 500

    this.setupLights()
    this.grid = new THREE.GridHelper(10, 20, 0x555555, 0x3a3a3a)
    this.scene.add(this.grid)

    window.addEventListener('resize', () => this.onResize())
    this.renderer.setAnimationLoop(() => this.tick())
  }

  /** Luz chapada, sem sombras — próxima do visual "Solid + Studio" do Blender. */
  private setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 1.1)
    this.scene.add(ambient)

    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(4, 6, 4)
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(0xffffff, 0.5)
    fill.position.set(-4, 2, -4)
    this.scene.add(fill)
  }

  /** Redimensiona e reposiciona o grid para acompanhar a escala do modelo carregado. */
  private fitGridToObject(box: THREE.Box3) {
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.z) || 1
    const gridSize = maxDim * 4

    this.scene.remove(this.grid)
    this.grid.geometry.dispose()
    this.grid = new THREE.GridHelper(gridSize, 20, 0x555555, 0x3a3a3a)
    this.grid.position.set((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2)
    this.scene.add(this.grid)
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  private tick() {
    this.controls.autoRotate = this.autoRotate
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  /** Carrega um FBX a partir de bytes já lidos (drag-and-drop / input de arquivo). */
  async loadFBX(buffer: ArrayBuffer, texture?: THREE.Texture): Promise<void> {
    this.clearModel()

    const loader = new FBXLoader()
    const object = loader.parse(buffer, '')

    let triCount = 0
    let objectCount = 0

    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        objectCount++
        const geometry = child.geometry
        const indexCount = geometry.index ? geometry.index.count : geometry.attributes.position.count
        triCount += indexCount / 3

        const material = new THREE.MeshLambertMaterial({
          color: 0xcccccc,
          map: texture ?? null,
          wireframe: this.wireframe,
        })
        child.material = material
      }
    })

    this.currentModel = object
    this.scene.add(object)
    this.frameObject(object)
    this.onStatsChange({ tris: Math.round(triCount), objects: objectCount })
  }

  /** Aplica (ou substitui) a textura no modelo já carregado. */
  applyTexture(texture: THREE.Texture) {
    if (!this.currentModel) return
    this.currentModel.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
        child.material.map = texture
        child.material.needsUpdate = true
      }
    })
  }

  toggleWireframe(): boolean {
    this.wireframe = !this.wireframe
    this.currentModel?.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
        child.material.wireframe = this.wireframe
      }
    })
    return this.wireframe
  }

  toggleAutoRotate(): boolean {
    this.autoRotate = !this.autoRotate
    return this.autoRotate
  }

  /** Centraliza e enquadra a câmera no objeto carregado. */
  frameObject(object: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(object)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const distance = maxDim * 1.8

    this.controls.target.copy(center)
    this.camera.position.copy(center).add(new THREE.Vector3(distance, distance * 0.6, distance))
    this.camera.near = maxDim / 100
    this.camera.far = maxDim * 100
    this.camera.updateProjectionMatrix()
    this.controls.update()
  }

  resetCamera() {
    if (this.currentModel) this.frameObject(this.currentModel)
  }

  clearModel() {
    if (this.currentModel) {
      this.scene.remove(this.currentModel)
      this.currentModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (child.material instanceof THREE.Material) child.material.dispose()
        }
      })
      this.currentModel = null
    }
    this.onStatsChange({ tris: 0, objects: 0 })
  }
}
