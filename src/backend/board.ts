/**
 * Board assembly: detect the BMAD version, load the right adapter, and apply
 * status writes. No host APIs here, only files, so it is unit-testable.
 */
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { detect, findEpicsText, type Detection } from './config';
import { buildDetail } from './detail';
import { isDir, isFile } from './fsutil';
import { loadV6, setStatusV6, V6_STORY_STATUSES } from './v6';
import { loadV7, setStatusV7, type V7Result } from './v7';
import type {
  Banner,
  BoardModel,
  Epic,
  SetStatusResponse,
  Story,
  StoryDetail,
} from '../shared/types';

export interface LoadedBoard {
  detection: Detection;
  /** Everything except sessions and rev, which the runtime adds. */
  model: Omit<BoardModel, 'sessions' | 'rev'>;
  v7?: V7Result;
  initiative: string | null;
}

export function loadBoard(projectRoot: string, requestedInitiative?: string): LoadedBoard {
  const detection = detect(projectRoot);
  const { config } = detection;
  const banners: Banner[] = [];
  let epics: Epic[] = [];
  let stories: Story[] = [];
  let v7: V7Result | undefined;
  let initiative: string | null = null;

  const initiatives = [...detection.initiatives];
  if (config.activeInitiative && !initiatives.includes(config.activeInitiative) && isDir(join(config.outputFolder, config.activeInitiative))) {
    initiatives.push(config.activeInitiative);
  }

  if (detection.version === 'v7') {
    initiative = requestedInitiative && initiatives.includes(requestedInitiative)
      ? requestedInitiative
      : config.activeInitiative ?? initiatives[0] ?? null;

    if (detection.legacySprintAlongsideV7) {
      banners.push({
        id: 'legacy-sprint',
        kind: 'warning',
        message: 'An old v6 sprint-status.yaml sits next to the v7 ticket tree. The board shows v7 and ignores it.',
        action: { label: 'Run bmad migrate method', promptSetting: 'migrate' },
      });
    }
    if (!initiative || !isFile(join(config.outputFolder, initiative, 'tickets', 'tickets.toml'))) {
      banners.push({
        id: 'no-initiative',
        kind: 'warning',
        message: initiative
          ? `Initiative "${initiative}" has no tickets/tickets.toml yet, so there is nothing to show.`
          : 'v7 detected but no initiative is active. Set `active_initiative` under [core] in _bmad/custom/config.user.toml.',
      });
    } else {
      v7 = loadV7(config.outputFolder, initiative);
      epics = v7.epics;
      stories = v7.stories;
      if (v7.parentInitiative) {
        banners.push({
          id: 'parent-initiative',
          kind: 'warning',
          message: `"${initiative}" is a parent initiative (its tickets.toml lists child initiatives). Pick a child in the Initiative filter.`,
        });
      }
    }
  } else if (detection.version === 'v6' && detection.sprintFile) {
    const loaded = loadV6(detection.sprintFile, findEpicsText(config, detection.sprintFile));
    epics = loaded.epics;
    stories = loaded.stories;
    const unknown = stories.filter((s) => s.unknownStatus).length;
    if (unknown) {
      banners.push({
        id: 'unknown-status',
        kind: 'info',
        message: `${unknown} ${unknown === 1 ? 'story has' : 'stories have'} a status outside ${V6_STORY_STATUSES.join(' / ')}. Shown in Backlog until fixed in sprint-status.yaml.`,
      });
    }
  } else {
    banners.push({
      id: 'none',
      kind: 'info',
      message: 'No BMAD sprint-status.yaml or v7 ticket tree found in this project.',
      action: { label: 'Start planning', promptSetting: 'plan' },
    });
  }

  return {
    detection,
    v7,
    initiative,
    model: {
      version: detection.version,
      projectRoot,
      outputRoot: isDir(config.outputFolder) ? config.outputFolder : null,
      initiatives,
      activeInitiative: initiative,
      banners,
      epics,
      stories,
    },
  };
}

export function findStory(loaded: LoadedBoard, storyId: string): Story {
  const story = loaded.model.stories.find((s) => s.id === storyId);
  if (!story) throw new Error(`Story "${storyId}" is no longer in the project files. Refresh the board.`);
  return story;
}

/** Hash of the model, so the panel can skip re-rendering when nothing changed. */
export function revOf(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

export function storyDetail(loaded: LoadedBoard, storyId: string): StoryDetail {
  const story = findStory(loaded, storyId);
  const files: Array<{ label: string; path: string }> = [];
  if (loaded.model.version === 'v6') {
    if (story.file) files.push({ label: 'Story file', path: story.file });
  } else if (loaded.v7) {
    const info = loaded.v7.writeInfo.get(storyId);
    if (info?.leafFile) files.push({ label: 'Story', path: info.leafFile });
    if (story.hasPlan && info) files.push({ label: 'Plan', path: info.planFile });
    const epic = loaded.model.epics.find((e) => e.id === story.epicId);
    if (epic?.file) files.push({ label: 'Epic', path: epic.file });
  }
  return buildDetail(story, files);
}

/** Status values the board may write for a version; anything else is refused. */
export function allowedStatuses(version: BoardModel['version']): readonly string[] {
  return version === 'v6'
    ? [...V6_STORY_STATUSES]
    : ['draft', 'ready-for-dev', 'in-progress', 'in-review', 'built', 'done', 'blocked', 'dropped'];
}

export function applyStatus(loaded: LoadedBoard, storyId: string, status: string): SetStatusResponse {
  const story = findStory(loaded, storyId);
  const version = loaded.model.version;
  if (!allowedStatuses(version).includes(status)) {
    throw new Error(`"${status}" is not a ${version} status.`);
  }
  if (!story.movable) throw new Error(story.lockedReason ?? 'This story cannot be moved.');

  if (version === 'v6') {
    const sprintFile = loaded.detection.sprintFile;
    if (!sprintFile) throw new Error('sprint-status.yaml disappeared. Refresh the board.');
    const res = setStatusV6(sprintFile, story.id, status);
    return { ok: true, ...(res.epicBumped ? { epicBumped: res.epicBumped } : {}) };
  }
  if (version === 'v7' && loaded.v7) {
    const info = loaded.v7.writeInfo.get(storyId);
    if (!info) throw new Error(`No plan location known for ${storyId}.`);
    setStatusV7({ planFile: info.planFile, ticket: info.ticket, title: info.title, status });
    return { ok: true };
  }
  throw new Error('Nothing to write to: no BMAD files detected.');
}
