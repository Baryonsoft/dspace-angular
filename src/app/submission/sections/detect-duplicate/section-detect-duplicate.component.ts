import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';

import { Observable, Subscription } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

import { SectionsType } from '../sections-type';
import { SectionModelComponent } from '../models/section.model';
import { renderSectionFor } from '../sections-decorator';
import { SectionDataObject } from '../models/section-data.model';
import { SortDirection, SortOptions } from '../../../core/cache/models/sort-options.model';
import { PaginationComponentOptions } from '../../../shared/pagination/pagination-component-options.model';
import { SubmissionService } from '../../submission.service';
import { SubmissionScopeType } from '../../../core/submission/submission-scope-type';
import { AlertType } from '../../../shared/alert/aletr-type';
import { DetectDuplicateService } from './detect-duplicate.service';
import { SectionsService } from '../sections.service';
import { hasValue } from '../../../shared/empty.util';

@Component({
  selector: 'ds-submission-section-detect-duplicate',
  templateUrl: './section-detect-duplicate.component.html',
  changeDetection: ChangeDetectionStrategy.Default
})

@renderSectionFor(SectionsType.DetectDuplicate)
export class SubmissionSectionDetectDuplicateComponent extends SectionModelComponent {
  public AlertTypeEnum = AlertType;
  public isLoading = true;
  public sectionData$: Observable<any>;
  public matches = {};
  public totalMatch$: Observable<number>;

  config: PaginationComponentOptions;
  sortConfig: SortOptions;

  isWorkFlow = false;
  disclaimer: Observable<string>;
  sub: Subscription;

  constructor(protected detectDuplicateService: DetectDuplicateService,
              protected translate: TranslateService,
              protected sectionService: SectionsService,
              protected submissionService: SubmissionService,
              @Inject('collectionIdProvider') public injectedCollectionId: string,
              @Inject('sectionDataProvider') public injectedSectionData: SectionDataObject,
              @Inject('submissionIdProvider') public injectedSubmissionId: string) {
    super(injectedCollectionId, injectedSectionData, injectedSubmissionId, undefined);
  }

  onSectionInit() {
    this.config = new PaginationComponentOptions();
    this.config.id = 'duplicated_items';
    this.config.pageSize = 2;
    this.sortConfig = new SortOptions('dc.title', SortDirection.ASC);

    this.sectionData$ = this.detectDuplicateService.getDuplicateMatches(this.submissionId, this.sectionData.id);

    this.totalMatch$ = this.detectDuplicateService.getDuplicateTotalMatches(this.submissionId, this.sectionData.id);

    this.isWorkFlow = this.submissionService.getSubmissionScope() === SubmissionScopeType.WorkflowItem;

    this.disclaimer = this.isWorkFlow ?
      this.translate.get('submission.sections.detect-duplicate.disclaimer-ctrl')
      : this.translate.get('submission.sections.detect-duplicate.disclaimer');

    this.isLoading = false;

    this.sub = this.totalMatch$.pipe(
      map((totalMatches: number) => totalMatches === 0),
      distinctUntilChanged())
      .subscribe((status: boolean) => {
        this.sectionService.setSectionStatus(this.submissionId, this.sectionData.id, status);
      })
  }

  protected getSectionStatus(): Observable<boolean> {
    return this.totalMatch$.pipe(
      map((totalMatches: number) => totalMatches === 0));
  }

  setPage(page) {
    this.config.currentPage = page;
  }

  onSectionDestroy(): void {
    if (hasValue(this.sub)) {
      this.sub.unsubscribe();
    }
  }

}
