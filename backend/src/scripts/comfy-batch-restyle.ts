import dotenv from 'dotenv';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import {
  cloneComfyJson,
  createComfyClient,
  downloadComfyOutput,
  readComfyJsonFile,
  setComfyMappedInput,
  submitComfyPrompt,
  uploadImageBinaryToComfy,
  waitForComfyHistory,
  type ComfyOutputFile,
  type ComfyWorkflowMap,
} from '../modules/virtual-try-on/providers/comfy-virtual-try-on.provider';

dotenv.config({ path: path.resolve('.env') });

type RunDefinition = {
  id: number;
  source: string;
  label: string;
  subjectRule?: string;
  wardrobe: string;
  scene: string;
};

type RunStatus = RunDefinition & {
  state: 'pending' | 'running' | 'complete' | 'failed';
  promptId?: string;
  outputs?: string[];
  error?: string;
};

const root = path.resolve('..');
const outputRoot = path.join(root, 'output', 'comfy-batch-2026-08-09');
const workflowPath = path.resolve('config/comfy-workflows/fashion-tryon-gemini-4in1-api.json');
const workflowMapPath = path.resolve('config/comfy-workflows/fashion-tryon-gemini-4in1-map.json');

const female = [
  'image/nu/1786261414147_57375024871644071_3539258321135238257_6a903a03bf21d9dc350c3a8372296811.jpg',
  'image/nu/1786261414314_57375024871644071_3539258321135238257_c6cf958e8d053c6dee7c77d49e3175d4.jpg',
  'image/nu/1786261414423_57375024871644071_3539258321135238257_96ff743a36f3e974775c832ea74e7157.jpg',
  'image/nu/1786261414525_57375024871644071_3539258321135238257_41d21c67299d3a67e09d2e2e435b446f.jpg',
  'image/nu/1786261414857_57375024871644071_3539258321135238257_011650d46625be83be96eaec8d6e9fea.jpg',
  'image/nu/1786261415177_57375024871644071_3539258321135238257_2c9baa7c5a8ba9c5ea4855410a115d3e.jpg',
].map((file) => path.join(root, file));

const male = [
  'image/nam/1786261413694_57375024871644071_3539258321135238257_2ffd78321ab64d443e73818555e235d9.jpg',
  'image/nam/1786261413815_57375024871644071_3539258321135238257_6d8d82a006658e8fe81b4a718d122443.jpg',
  'image/nam/1786261413929_57375024871644071_3539258321135238257_83f9341dfc56374a04d58120458012e1.jpg',
  'image/nam/1786261414021_57375024871644071_3539258321135238257_a6e7b8d602e1501a0c1b74d0b166a979.jpg',
  'image/nam/1786261414635_57375024871644071_3539258321135238257_178bb8e73ac630b82f4f43792803d445.jpg',
  'image/nam/1786261414736_57375024871644071_3539258321135238257_21a9d9a3094bc7a01e717690cf15b981.jpg',
  'image/nam/1786261414956_57375024871644071_3539258321135238257_c35548acaf54911044b11652d36a2c2b.jpg',
  'image/nam/1786261415064_57375024871644071_3539258321135238257_e37affb95fabaf5dc69f7972a18be570.jpg',
].map((file) => path.join(root, file));

const runs: RunDefinition[] = [
  { id: 1, source: female[0], label: 'female-01-modern-executive', wardrobe: 'a sand-beige double-breasted blazer over a fitted ivory silk shell, high-waisted black wide-leg trousers, a slim leather belt, and understated loafers', scene: 'a refined contemporary office lobby, soft window light, quiet-luxury editorial color grading' },
  { id: 2, source: female[0], label: 'female-01-modern-ao-dai', wardrobe: 'a modern Vietnamese ao dai in deep teal silk with delicate tonal botanical embroidery, elegant long panels, matching flowing trousers, and minimal pearl earrings', scene: 'a clean architectural courtyard with warm morning light and subtle Vietnamese design details' },
  { id: 3, source: female[1], label: 'female-02-pastel-preppy', wardrobe: 'a powder-blue cropped cardigan over a white Peter Pan collar blouse, a charcoal pleated mini skirt, ivory socks, and polished Mary Jane shoes', scene: 'a lively yet softly blurred spring street, airy pastel fashion campaign lighting' },
  { id: 4, source: female[1], label: 'female-02-dark-academia', wardrobe: 'a chocolate tweed blazer, cream cable-knit vest, crisp white shirt, dark brown pleated skirt, opaque tights, and burgundy loafers', scene: 'an old university courtyard at golden hour, cinematic dark-academia mood' },
  { id: 5, source: female[2], label: 'female-03-clean-athleisure', wardrobe: 'a cropped stone-gray technical windbreaker layered over a fitted black mock-neck top, coordinated high-waisted utility trousers, and minimal silver accessories', scene: 'a sleek transit concourse with cool diffused light and clean sporty editorial styling' },
  { id: 6, source: female[2], label: 'female-03-soft-korean-casual', wardrobe: 'an oatmeal oversized knit cardigan over a pale blue striped shirt, a soft charcoal midi skirt, and a small structured cream shoulder bag', scene: 'a bright minimalist cafe with gentle daylight and calm Korean lifestyle photography' },
  { id: 7, source: female[3], label: 'female-04-parisian-tweed', wardrobe: 'a fitted ivory-and-black bouclé jacket with pearl buttons, a black satin camisole, tailored high-waisted trousers, and delicate gold jewelry', scene: 'an intimate Parisian reading room, warm lamp light, polished luxury editorial finish' },
  { id: 8, source: female[3], label: 'female-04-satin-evening', wardrobe: 'an emerald satin midi dress with an elegant square neckline, softly draped waist, refined cap sleeves, and crystal drop earrings', scene: 'a sophisticated hotel lounge at night with amber highlights and cinematic bokeh' },
  { id: 9, source: female[4], label: 'female-05-cottagecore', wardrobe: 'a sage-green floral cottagecore dress with a modest square neckline, smocked bodice, sheer balloon sleeves, and fine lace trim', scene: 'a sunlit conservatory filled with soft greenery, dreamy natural-light portrait mood' },
  { id: 10, source: female[4], label: 'female-05-monochrome-street', wardrobe: 'a black cropped moto jacket over a ribbed graphite top, high-waisted charcoal cargo trousers, a silver chain detail, and a compact crossbody bag', scene: 'a modern concrete gallery with crisp side lighting and restrained monochrome street-style energy' },
  { id: 11, source: female[5], label: 'female-06-red-power-suit', wardrobe: 'a sharply tailored scarlet pantsuit with a sculpted single-button blazer, tonal silk camisole, flared trousers, and pointed nude heels', scene: 'a premium white fashion studio with dramatic softbox lighting and a glossy magazine campaign finish' },
  { id: 12, source: female[5], label: 'female-06-emerald-gala', wardrobe: 'a floor-length emerald evening gown with an asymmetric neckline, softly draped satin, a defined waist, and refined gold earrings', scene: 'an elegant gala staircase with warm chandelier light and luxurious cinematic depth' },
  { id: 13, source: male[0], label: 'male-01-japanese-workwear', wardrobe: 'an indigo Japanese chore jacket over a heavyweight white T-shirt, olive straight-leg fatigue trousers, and clean off-white canvas sneakers', scene: 'a quiet creative district street in late-afternoon sun, authentic menswear editorial texture' },
  { id: 14, source: male[0], label: 'male-01-resort-linen', wardrobe: 'a relaxed pale-sage linen shirt worn open over a white ribbed tank, cream drawstring trousers, brown woven belt details, and suede loafers', scene: 'a breezy coastal resort promenade at sunset, warm aspirational travel campaign lighting' },
  { id: 15, source: male[1], label: 'male-02-goalkeeper-pro', wardrobe: 'a professional long-sleeve goalkeeper jersey in electric cobalt with subtle geometric panels, matching black technical shorts, premium goalkeeper gloves, black socks, and modern football boots', scene: 'a professional stadium pitch under clean overcast match-day light, premium sports advertising style' },
  { id: 16, source: male[1], label: 'male-02-athleisure-track', wardrobe: 'a fitted forest-green quarter-zip performance top, tapered black track pants with minimal piping, technical crew socks, and white running trainers', scene: 'a modern athletics training ground at dawn with crisp energetic sports editorial lighting' },
  { id: 17, source: male[2], label: 'male-03-navy-business', wardrobe: 'a perfectly fitted midnight-navy two-piece suit, crisp white spread-collar shirt, burgundy silk tie, white pocket square, and a classic steel watch', scene: 'a premium business-school interior with soft directional light and confident graduation portrait styling' },
  { id: 18, source: male[2], label: 'male-03-preppy-ivy', wardrobe: 'a camel V-neck cricket sweater with navy trim over a pale-blue Oxford shirt, tailored charcoal trousers, and a refined leather watch', scene: 'a bright collegiate library corridor, polished Ivy League fashion editorial mood' },
  { id: 19, source: male[3], label: 'male-04-scandinavian-minimal', wardrobe: 'a long camel wool overcoat over a black fine-knit turtleneck, tailored black trousers, and minimal white leather sneakers', scene: 'a clean Nordic architectural plaza in cool winter daylight, understated luxury campaign styling' },
  { id: 20, source: male[3], label: 'male-04-vietnamese-streetwear', wardrobe: 'an oversized slate varsity jacket over a washed white graphic-free tee, loose black carpenter pants, and chunky gray sneakers', scene: 'a colorful contemporary Saigon pedestrian street at blue hour, polished urban lookbook lighting' },
  { id: 21, source: male[4], label: 'male-duo-varsity', subjectRule: 'The source contains exactly two primary foreground men. Preserve both distinct identities and their left-right positions. Restyle both men. Dress the man on the left in a forest-green varsity jacket, cream T-shirt, and dark straight trousers. Dress the man on the right in a cream varsity jacket with burgundy trim, charcoal T-shirt, and relaxed dark trousers. Never merge, swap, duplicate, or average their faces.', wardrobe: 'two coordinated but contrasting premium varsity outfits, one forest-green and cream and one cream with burgundy accents, with clean contemporary casual layering', scene: 'a stylish night cafe with warm practical lights, candid best-friends fashion campaign atmosphere' },
  { id: 22, source: male[4], label: 'male-duo-smart-casual', subjectRule: 'The source contains exactly two primary foreground men. Preserve both distinct identities and their left-right positions. Restyle both men. Dress the man on the left in a charcoal unstructured blazer, white knit polo, and black trousers. Dress the man on the right in a light-taupe overshirt, black mock-neck knit, and dark trousers. Never merge, swap, duplicate, or average their faces.', wardrobe: 'two coordinated modern smart-casual evening looks in charcoal, white, taupe, and black with distinct garments for each man', scene: 'an upscale contemporary restaurant lounge, warm cinematic lighting, natural friendship portrait energy' },
  { id: 23, source: male[5], label: 'male-06-old-money', wardrobe: 'a navy fine-knit polo under a lightweight cream cardigan, tailored stone trousers, and a slim brown leather watch', scene: 'a sunlit private-club garden terrace, quiet old-money menswear campaign aesthetic' },
  { id: 24, source: male[6], label: 'male-07-korean-tailoring', wardrobe: 'an oversized charcoal blazer over a black mock-neck top, relaxed wide black trousers, a minimal silver necklace, and black leather sneakers', scene: 'a textured minimalist art gallery at night, moody Korean menswear editorial lighting' },
  { id: 25, source: male[7], label: 'male-08-summer-street', wardrobe: 'an open short-sleeve bowling shirt in muted terracotta over a fitted white tank, relaxed drawstring linen trousers, and a simple silver chain', scene: 'a clean tropical apartment balcony at sunset, warm contemporary summer lookbook mood' },
];

const systemPrompt = [
  'You are a high-end photorealistic fashion restyling engine.',
  'Reference image 1 is the only identity and composition reference. Preserve every primary subject\'s recognizable face, hair, apparent age, skin tone, body shape, body proportions, glasses, expression, and source-image left-right placement.',
  'Design and apply the wardrobe described in the user prompt; there is no catalog-garment reference. Replace existing clothing only where required by the described look.',
  'Unless the user explicitly states that there are two primary subjects, restyle only the single main foreground person. Keep bystanders as unedited background and never turn a bystander into a featured subject.',
  'For a two-person request, keep exactly both primary people, preserve both different identities, and never merge, swap, duplicate, or average faces or bodies.',
  'The top-left cell must preserve the original pose, expression, camera angle, perspective, crop, and body alignment as closely as possible. The other three cells may use only subtle natural fashion-pose variations.',
  'Preserve the source body coverage and crop. Never invent unseen legs, feet, torso, hands, or face when the source is cropped.',
  'Make fabric construction, fit, folds, occlusion, lighting, contact shadows, and anatomy realistic. No logos unless explicitly requested.',
  'Return exactly one seamless 2x2 grid image whose four cells are borderless vertical 3:4 portraits. No gutters, labels, captions, watermarks, frames, or extra text.',
].join(' ');

const buildPrompt = (run: RunDefinition) => [
  'Create one seamless 2x2 fashion editorial grid.',
  run.subjectRule || 'Restyle only the main foreground person; all other people, if any, remain background and are not wardrobe references.',
  `WARDROBE: ${run.wardrobe}.`,
  `SCENE AND LIGHTING: ${run.scene}.`,
  'All four cells must show the same specified wardrobe and the same preserved identity or identities.',
  'Cell order: top-left baseline, top-right subtle pose variation, bottom-left subtle pose variation, bottom-right subtle pose variation.',
  'Keep styling tasteful, commercially usable, age-appropriate, and photorealistic.',
  'STRICTLY AVOID: changed identity, face swap, merged people, duplicated person, altered body shape, altered skin tone, extra limbs, missing limbs, deformed hands, distorted face, inconsistent outfit between cells, random logos, text, watermark, border, gutter, collage labels, blur, low resolution.',
].join(' ');

const mimeFor = (file: string) => file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

const collectOutputs = (history: { outputs?: Record<string, Record<string, ComfyOutputFile[] | undefined>> }) => {
  const files: ComfyOutputFile[] = [];
  for (const nodeId of ['12', '13', '14', '15']) {
    const images = history.outputs?.[nodeId]?.images;
    if (Array.isArray(images)) files.push(...images.filter((file) => Boolean(file?.filename)));
  }
  return files;
};

const saveManifest = async (statuses: RunStatus[]) => {
  await writeFile(path.join(outputRoot, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), runs: statuses }, null, 2));
};

const runOne = async (
  definition: RunDefinition,
  workflowTemplate: unknown,
  workflowMap: ComfyWorkflowMap,
  status: RunStatus,
) => {
  const client = createComfyClient();
  const runDir = path.join(outputRoot, `run-${String(definition.id).padStart(2, '0')}-${definition.label}`);
  await mkdir(runDir, { recursive: true });
  status.state = 'running';

  const sourceBuffer = await readFile(definition.source);
  const uploadedSource = await uploadImageBinaryToComfy(client, {
    buffer: sourceBuffer,
    mimeType: mimeFor(definition.source),
    fileName: `batch-restyle-${String(definition.id).padStart(2, '0')}-source${path.extname(definition.source)}`,
  });

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const workflow = cloneComfyJson(workflowTemplate) as Record<string, { inputs?: Record<string, unknown> }>;
      if (!setComfyMappedInput(workflow, workflowMap, 'personImage', uploadedSource)) {
        throw new Error('Workflow map is missing personImage');
      }
      if (!setComfyMappedInput(workflow, workflowMap, 'prompt', buildPrompt(definition))) {
        throw new Error('Workflow map is missing prompt');
      }
      setComfyMappedInput(workflow, workflowMap, 'seed', 8609000 + definition.id * 7919 + attempt);
      setComfyMappedInput(workflow, workflowMap, 'model', process.env.VIRTUAL_TRY_ON_COMFY_MODEL || 'Nano Banana 2 (Gemini 3.1 Flash Image)');
      setComfyMappedInput(workflow, workflowMap, 'aspectRatio', process.env.VIRTUAL_TRY_ON_COMFY_ASPECT_RATIO || '3:4');
      setComfyMappedInput(workflow, workflowMap, 'resolution', process.env.VIRTUAL_TRY_ON_COMFY_RESOLUTION || '2K');

      if (!workflow['9']?.inputs || !workflow['56']?.inputs) throw new Error('Unexpected workflow structure');
      workflow['9'].inputs.system_prompt = systemPrompt;
      workflow['56'].inputs = { 'images.image0': ['1', 0] };

      const promptId = await submitComfyPrompt(client, workflow);
      status.promptId = promptId;
      const history = await waitForComfyHistory(client, promptId, 300_000, 2_500, 8_000);
      const files = collectOutputs(history);
      if (files.length < 4) throw new Error(`Expected 4 output images, received ${files.length}`);

      const downloaded = await Promise.all(files.slice(0, 4).map((file) => downloadComfyOutput(client, file, 'image/png')));
      status.outputs = [];
      for (const [index, image] of downloaded.entries()) {
        const extension = image.mimeType === 'image/jpeg' ? '.jpg' : '.png';
        const outputPath = path.join(runDir, `variation-${index + 1}${extension}`);
        await writeFile(outputPath, image.buffer);
        status.outputs.push(outputPath);
      }
      await writeFile(path.join(runDir, 'prompt.txt'), `${buildPrompt(definition)}\n`);
      status.state = 'complete';
      console.log(`COMPLETE ${definition.id}/25 ${definition.label} prompt=${promptId}`);
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`RETRY ${definition.id}/25 attempt=${attempt} ${message}`);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 10_000 * attempt));
    }
  }

  status.state = 'failed';
  status.error = lastError instanceof Error ? lastError.message : String(lastError);
  console.log(`FAILED ${definition.id}/25 ${definition.label}: ${status.error}`);
};

const main = async () => {
  await mkdir(outputRoot, { recursive: true });
  const [workflowTemplate, workflowMap] = await Promise.all([
    readComfyJsonFile<unknown>(workflowPath),
    readComfyJsonFile<ComfyWorkflowMap>(workflowMapPath),
  ]);
  const statuses: RunStatus[] = runs.map((run) => ({ ...run, state: 'pending' }));
  await saveManifest(statuses);

  let cursor = 0;
  const worker = async () => {
    while (cursor < runs.length) {
      const index = cursor;
      cursor += 1;
      await runOne(runs[index], workflowTemplate, workflowMap, statuses[index]);
      await saveManifest(statuses);
    }
  };

  await Promise.all([worker(), worker()]);
  await saveManifest(statuses);
  const complete = statuses.filter((status) => status.state === 'complete').length;
  const failed = statuses.filter((status) => status.state === 'failed').length;
  console.log(`SUMMARY complete=${complete} failed=${failed} output=${outputRoot}`);
  if (failed) process.exitCode = 1;
};

const keepAlive = setInterval(() => undefined, 1_000);
void main().finally(() => clearInterval(keepAlive));
