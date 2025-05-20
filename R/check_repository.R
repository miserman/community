#' Check Data Repositories
#'
#' Performs a series of checks to see if data in a given repository can be ingested by a datacommons project.
#'
#' @param dir Root directory of the data repository.
#' @param search_pattern Regular expression used to search for data files.
#' @param exclude Subdirectories to exclude from the file search.
#' @param value Name of the column containing variable values.
#' @param value_name Name of the column containing variable names.
#' @param id Column name of IDs that uniquely identify entities.
#' @param time Column name of the variable representing time.
#' @param dataset Column name used to separate data into sets (such as by region), or a vector
#' of datasets, with \code{id}s as names, used to map IDs to datasets.
#' @param entity_info A vector of variable names to go into making \code{entity_info.json}.
#' @param check_values Logical; if \code{FALSE}, will perform more intensive checks on values.
#' If not specified, these are skipped if there are more that 5 million rows in the given dataset,
#' in which case \code{TRUE} will force checks.
#' @param attempt_repair Logical; if \code{TRUE}, will attempt to fix most warnings in data files.
#' Use with caution, as this will often remove rows (given \code{NA}s) and rewrite the file.
#' @param write_infos Logical; if \code{TRUE}, will save standardized and rendered versions of each measure info file.
#' @param verbose Logical; If \code{FALSE}, will not print status messages or check results.
#' @examples
#' \dontrun{
#' # from a data repository
#' check_repository()
#'
#' # to automatically fix most warnings
#' check_repository(attempt_repair = TRUE)
#' }
#' @return An invisible list of check results, in the form of paths to files and/or measure name.
#' These may include \strong{general} entries:
#' \itemize{
#'   \item \strong{\code{info}} (always): All measurement information (\code{measure_info.json}) files found.
#'   \item \strong{\code{data}} (always): All data files found.
#'   \item \strong{\code{not_considered}}: Subset of data files that do not contain the minimal
#'     columns (\code{id} and \code{value}), and so are not checked further.
#'   \item \strong{\code{summary}} (always): Summary of results.
#' }
#' or those relating to issues with \strong{measure information} (see \code{\link{data_measure_info}}) files:
#' \itemize{
#'   \item \strong{\code{info_malformed}}: Files that are not in the expected format (a single object with
#'     named entries for each measure), but can be converted automatically.
#'   \item \strong{\code{info_incomplete}}: Measure entries that are missing some of the required fields.
#'   \item \strong{\code{info_invalid}}: Files that could not be read in (probably because they do not contain valid JSON).
#'   \item \strong{\code{info_refs_names}}: Files with a \code{_references} entry with no names
#'     (where it should be a named list).
#'   \item \strong{\code{info_refs_missing}}: Files with an entry in its \code{_references} entry that
#'     is missing one or more required entries (\code{author}, \code{year}, and/or \code{title}).
#'   \item \strong{\code{info_refs_*}}: Files with an entry in its \code{_references} entry that has an entry
#'     (\code{*}) that is a list (where they should all be strings).
#'   \item \strong{\code{info_refs_author_entry}}: Files with an entry in its \code{_references} entry that has an
#'     \code{author} entry that is missing a \code{family} entry.
#'   \item \strong{\code{info_source_missing}}: Measures with an entry in its \code{source} entry that is missing a
#'     required entry (\code{name} and/or \code{date_accessed}).
#'   \item \strong{\code{info_source_*}}: Measures with an entry (\code{*}) in its \code{source} entry that is a
#'     list (where they should all be strings).
#'   \item \strong{\code{info_citation}}: Measures with a \code{citation} entry that cannot be found in any
#'     \code{_references} entries across measure info files within the repository.
#'   \item \strong{\code{info_layer_source}}: Measures with an entry in its \code{layer} entry that is missing a
#'     \code{source} entry.
#'   \item \strong{\code{info_layer_source_url}}: Measures with an entry in its \code{layer} entry that has a list
#'     \code{source} entry that is missing a \code{url} entry. \code{source} entries can either be a string containing a
#'     URL, or a list with a \code{url} entry.
#'   \item \strong{\code{info_layer_filter}}: Measures with an entry in its \code{layer} entry that has a \code{filter}
#'     entry that is missing required entries (\code{feature}, \code{operator}, and/or \code{value}).
#' }
#' or relating to data files with \strong{warnings}:
#' \itemize{
#'   \item \strong{\code{warn_compressed}}: Files that do not have compression extensions
#'     (\code{.gz}, \code{.bz2}, or \code{.xz}).
#'   \item \strong{\code{warn_blank_colnames}}: Files with blank column names (often due to saving files with row names).
#'   \item \strong{\code{warn_value_nas}}: Files that have \code{NA}s in their \code{value} columns; \code{NA}s here
#'     are redundant with the tall format, and so, should be removed.
#'   \item \strong{\code{warn_double_ints}}: Variable names that have an \code{int} type, but with values that have
#'     remainders.
#'   \item \strong{\code{warn_small_percents}}: Variable names that have a \code{percent} type, but that are all under
#'     \code{1} (which are assumed to be raw proportions).
#'   \item \strong{\code{warn_small_values}}: Variable names with many values (over 40%) that are under \code{.00001}, and
#'     no values under \code{0} or over \code{1}. These values should be scaled in some way to be displayed reliably.
#'   \item \strong{\code{warn_value_name_nas}}: Files that have \code{NA}s in their \code{name} column.
#'   \item \strong{\code{warn_entity_info_nas}}: Files that have \code{NA}s in any of their \code{entity_info} columns.
#'   \item \strong{\code{warn_dataset_nas}}: Files that have \code{NA}s in their \code{dataset} column.
#'   \item \strong{\code{warn_time_nas}}: Files that have \code{NA}s in their \code{time} column.
#'   \item \strong{\code{warn_id_nas}}: Files that have \code{NA}s in their \code{id} column.
#'   \item \strong{\code{warn_scientific}}: Files with IDs that appear to have scientific notation (e.g., \code{1e+5});
#'     likely introduced when the ID column was converted from numbers to characters -- IDs should always be saved as
#'     characters.
#'   \item \strong{\code{warn_bg_agg}}: Files with IDs that appear to be census block group GEOIDs,
#'     that do not include their tract parents (i.e., IDs consisting of 12 digits, and there are no IDs consisting of
#'     their first 11 digits). These are automatically aggregated by \code{\link{site_build}}, but they should
#'     be manually aggregated.
#'   \item \strong{\code{warn_tr_agg}}: Files with IDs that appear to be census tract GEOIDs,
#'     that do not include their county parents (i.e., IDs consisting of 11 digits, and there are no IDs consisting of
#'     their first 5 digits). These are automatically aggregated by \code{\link{site_build}}, but they should
#'     be manually aggregated.
#'   \item \strong{\code{warn_missing_info}}: Measures in files that do not have a corresponding \code{measure_info.json}
#'     entry. Sometimes this happens because the entry includes a prefix that cannot be derived from the file name
#'     (which is the part after a year, such as \code{category} from \code{set_geo_2015_category.csv.xz}).
#'     It is recommended that entries not include prefixes, and that measure names be specific
#'     (e.g., \code{category_count} rather than \code{count} with a \code{category:count} entry).
#' }
#' or relating to data files with \strong{failures}:
#' \itemize{
#'   \item \strong{\code{fail_read}}: Files that could not be read in.
#'   \item \strong{\code{fail_rows}}: Files containing no rows.
#'   \item \strong{\code{fail_time}}: Files with no \code{time} column.
#'   \item \strong{\code{fail_idlen_county}}: Files with "county" \code{dataset}s with corresponding IDs
#'     that are not consistently 5 characters long.
#'   \item \strong{\code{fail_idlen_tract}}: Files with "tract" \code{dataset}s with corresponding IDs
#'     that are not consistently 11 characters long.
#'   \item \strong{\code{fail_idlen_block_group}}: Files with "block group" \code{dataset}s with corresponding IDs
#'     that are not consistently 12 characters long.
#' }
#' @export

check_repository <- function(
  dir = ".",
  search_pattern = "\\.csv(?:\\.[gbx]z2?)?$",
  exclude = NULL,
  value = "value",
  value_name = "measure",
  id = "geoid",
  time = "year",
  dataset = "region_type",
  entity_info = c("region_type", "region_name"),
  check_values = TRUE,
  attempt_repair = FALSE,
  write_infos = FALSE,
  verbose = TRUE
) {
  if (!dir.exists(dir)) cli_abort("{.path {dir}} does not exist")
  project_check <- check_template("repository", dir = dir)
  if (project_check$exists) {
    if (length(project_check$incomplete)) {
      cli_alert_warning(
        "please update template content in {.file {project_check$incomplete}}"
      )
    }
  }
  files <- list.files(dir, search_pattern, recursive = TRUE, full.names = TRUE)
  files <- sort(files[
    !grepl(
      paste0(
        "[/\\](?:docs|code|working|original",
        if (length(exclude)) paste0("|", paste(exclude, collapse = "|")),
        ")[/\\]"
      ),
      files,
      TRUE
    )
  ])
  if (!length(files)) cli_abort("no files found")
  i <- 0
  if (verbose) cli_h1("measure info")
  meta <- list()
  info_files <- sort(list.files(
    dir,
    "^measure_info[^.]*\\.json$",
    full.names = TRUE,
    recursive = TRUE
  ))
  info_files <- info_files[
    !grepl("docs/data", info_files, fixed = TRUE) &
      !duplicated(gsub("_rendered|/code/|/data/", "", info_files))
  ]
  results <- list(data = files, info = info_files)
  required_fields <- c(
    "category",
    "long_name",
    "short_name",
    "long_description",
    "aggregation_method",
    "data_type"
  )
  required_refs <- c("author", "year", "title")
  required_source <- c("name", "date_accessed")
  required_layer_filter <- c("feature", "operator", "value")
  known_references <- NULL
  flagged_references <- list()
  if (verbose) {
    cli_progress_step(
      "checking {i} of {length(info_files)} measure info files",
      "checked {length(info_files)} measure info files",
      spinner = TRUE
    )
  }
  all_issues <- list()
  for (f in info_files) {
    m <- tryCatch(
      data_measure_info(
        f,
        render = TRUE,
        write = write_infos,
        verbose = FALSE,
        open_after = FALSE
      ),
      error = function(e) NULL
    )
    if (is.null(m)) cli_abort("measure info is malformed: {.file {f}}")
    i <- i + 1
    if (verbose) cli_progress_update()
    issues <- NULL
    if (!is.null(m$unit) && !is.null(m$short_name)) {
      issues <- "recoverably malformed (should be an object with named entries for each measure)"
      results$info_malformed <- c(results$info_malformed, f)
      m <- list(m)
      names(m) <- m[[1]]$measure
    }
    if ("_references" %in% names(m)) {
      refs <- m[["_references"]]
      if (is.null(names(refs))) {
        if (length(refs)) {
          results$info_refs_names[[f]] <- c(results$info_refs_names, f)
          issues <- c(issues, "{.arg _references} entries have no names")
        }
      } else {
        for (e in names(refs)) {
          known_references <- unique(c(known_references, e))
          su <- !required_refs %in% names(refs[[e]])
          if (any(su)) {
            missing_required <- required_refs[su]
            results$info_refs_missing[[f]] <- c(
              results$info_refs_missing[[f]],
              paste0(e, ":", paste(missing_required, collapse = ","))
            )
            issues <- c(
              issues,
              paste0(
                "{.arg _references} {.strong {.field ",
                e,
                "}} is missing ",
                if (sum(su) > 1) "entries: " else "an entry: ",
                paste0("{.pkg ", missing_required, "}", collapse = ", ")
              )
            )
          }
          if ("author" %in% names(refs[[e]])) {
            if (!is.list(refs[[e]]$author) || !is.null(names(refs[[e]]$author)))
              refs[[e]]$author <- list(refs[[e]]$author)
            for (i in seq_along(refs[[e]]$author)) {
              if (
                is.list(refs[[e]]$author[[i]]) &&
                  is.null(refs[[e]]$author[[i]]$family)
              ) {
                results$info_refs_author_entry[[f]] <- c(
                  results$info_refs_author_entry[[f]],
                  paste0(e, ":", i)
                )
                issues <- c(
                  issues,
                  paste0(
                    "{.arg _references} {.strong {.field ",
                    e,
                    "}}'s number ",
                    i,
                    " author is missing a {.pkg family} entry"
                  )
                )
              }
            }
          }
          for (re in c(
            "year",
            "title",
            "journal",
            "volume",
            "page",
            "doi",
            "version",
            "url"
          )) {
            if (is.list(refs[[e]][[re]])) {
              type <- paste0("info_refs_", re)
              results[[type]][[f]] <- c(results[[type]][[f]], e)
              issues <- c(
                issues,
                paste0(
                  "{.arg _references} {.strong {.field ",
                  e,
                  "}}'s {.pkg ",
                  re,
                  "} entry is a list"
                )
              )
            }
          }
        }
      }
    }
    for (n in sort(names(m))) {
      if (!grepl("^_", n)) {
        cm <- Filter(
          function(e) length(e) && (length(e) > 1 || e != ""),
          m[[n]]
        )
        entries <- names(cm)
        mf <- required_fields[!required_fields %in% entries]
        if (length(mf)) {
          results$info_incomplete[[f]] <- c(results$info_incomplete[[f]], n)
          issues <- c(
            issues,
            paste0(
              "{.strong {.field ",
              n,
              "}} is missing ",
              if (length(mf) > 1) "fields" else "a field",
              ": ",
              paste(paste0("{.pkg ", mf, "}"), collapse = ", ")
            )
          )
        }
        if ("sources" %in% entries) {
          if (!is.null(names(cm$sources))) cm$sources <- list(cm$sources)
          for (i in seq_along(cm$sources)) {
            s <- cm$sources[[i]]
            if (length(s) && is.list(s)) {
              su <- !required_source %in% names(s)
              if (any(su)) {
                missing_required <- required_source[su]
                results$info_source_missing[[f]] <- c(
                  results$info_source_missing[[f]],
                  paste0(m, ":", paste(missing_required, collapse = ","))
                )
                issues <- c(
                  issues,
                  paste0(
                    "{.strong {.field ",
                    n,
                    "}}'s number ",
                    i,
                    " {.arg source} entry is missing ",
                    if (sum(su) > 1) "entries: " else "an entry: ",
                    paste0("{.pkg ", missing_required, "}", collapse = ", ")
                  )
                )
              }
            }
            for (re in c(required_source, "location", "location_url")) {
              if (is.list(s[[re]])) {
                type <- paste0("info_source_", re)
                results[[type]][[f]] <- c(results[[type]][[f]], n)
                issues <- c(
                  issues,
                  paste0(
                    "{.strong {.field ",
                    n,
                    "}}'s number ",
                    i,
                    " {.arg source} entry's {.pkg ",
                    re,
                    "} entry is a list"
                  )
                )
              }
            }
          }
        }
        if ("citations" %in% entries) {
          citations <- unlist(cm$citations, use.names = FALSE)
          su <- !citations %in% known_references
          if (any(su)) {
            name <- paste0(f, ":::", n)
            flagged_references[[name]] <- citations[su]
          }
        }
        if ("layer" %in% entries) {
          if ("source" %in% names(cm$layer)) {
            if (
              is.list(cm$layer$source) && !"url" %in% names(cm$layer$source)
            ) {
              results$info_layer_source_url[[f]] <- c(
                results$info_layer_source_url[[f]],
                n
              )
              issues <- c(
                issues,
                paste0(
                  "{.strong {.field ",
                  n,
                  "}}'s {.arg source} entry is a list, but doesn't have a {.pkg url} entry"
                )
              )
            }
          } else {
            results$info_layer_source[[f]] <- c(
              results$info_layer_source[[f]],
              n
            )
            issues <- c(
              issues,
              paste0(
                "{.strong {.field ",
                n,
                "}}'s {.arg layer} entry is missing a {.pkg source} entry"
              )
            )
          }
          if ("filter" %in% names(cm$layer)) {
            if (!is.null(names(cm$layer$filter)))
              cm$layer$filter <- list(cm$layer$filter)
            for (i in seq_along(cm$layer$filter)) {
              missing_required <- required_layer_filter[
                !required_layer_filter %in% names(cm$layer$filter[[i]])
              ]
              if (length(missing_required)) {
                results$info_layer_filter[[f]] <- c(
                  results$info_layer_filter[[f]],
                  n
                )
                issues <- c(
                  issues,
                  paste0(
                    "{.strong {.field ",
                    n,
                    "}}'s number ",
                    i,
                    " {.arg filter} entry is missing ",
                    if (length(missing_required) > 1) "entries: " else
                      "an entry: ",
                    paste(
                      paste0("{.pkg ", missing_required, "}"),
                      collapse = ", "
                    )
                  )
                )
              }
            }
          }
        }
      }
    }
    if (length(issues)) {
      names(issues) <- rep(">", length(issues))
      all_issues[[f]] <- issues
    }
    if (length(m)) {
      meta <- c(meta, m)
    } else {
      results$info_invalid <- c(results$info_invalid, f)
    }
  }
  rendered_names <- names(meta)
  if (verbose) cli_progress_done()
  if (verbose && !length(meta)) cli_alert_danger("no valid measure info")
  if (length(flagged_references)) {
    for (r in sort(names(flagged_references))) {
      su <- !flagged_references[[r]] %in% known_references
      if (any(su)) {
        f <- strsplit(r, ":::", fixed = TRUE)[[1]]
        results$info_citation[[f[1]]] <- c(
          results$info_citation[[f[1]]],
          paste0(
            f[2],
            ": ",
            paste(flagged_references[[r]][su], collapse = ", ")
          )
        )
        all_issues[[f[1]]] <- c(
          all_issues[[f[1]]],
          c(
            ">" = paste0(
              "unknown {.arg citation} ",
              if (sum(su) > 1) "entries" else "entry",
              " in {.strong {.field ",
              f[2],
              "}}: ",
              paste0(
                "{.pkg ",
                flagged_references[[r]][su],
                "}",
                collapse = ", "
              )
            )
          )
        )
      }
    }
  }
  if (verbose && length(all_issues)) {
    cli_h2("{length(all_issues)} measure info file{? has/s have} issues")
    for (f in names(all_issues)) {
      cli_alert_danger("{.file {f}}:")
      cli_bullets(all_issues[[f]])
    }
  }

  i <- 0
  if (verbose) {
    cli_h1("data")
    cli_progress_step(
      "checking {i} of {length(files)} data file{?/s}",
      "checked {length(files)} data file{?/s}",
      spinner = TRUE
    )
  }
  census_geolayers <- c(county = 5, tract = 11, "block group" = 12)
  required <- c(id, value_name, value)
  dataset_map <- NULL
  if (length(dataset) > 1) {
    dataset_map <- dataset
    dataset <- "dataset"
  }
  vars <- unique(c(required, time, dataset, entity_info))
  entity_info <- entity_info[!entity_info %in% c(required, time)]
  files_short <- sub("^/", "", sub(dir, "", files, fixed = TRUE))
  for (i in seq_along(files)) {
    if (verbose) cli_progress_update()
    path <- files[[i]]
    f <- files_short[[i]]
    sep <- if (grepl(".csv", path, fixed = TRUE)) "," else "\t"
    cols <- tryCatch(
      scan(path, "", sep = sep, nlines = 1, quiet = TRUE),
      error = function(e) NULL
    )
    lcols <- tolower(cols)
    su <- !cols %in% vars & lcols %in% vars
    if (any(su)) cols[su] <- lcols[su]
    if (all(required %in% cols)) {
      d <- if (is.null(cols)) {
        NULL
      } else {
        tryCatch(
          as.data.frame(read_delim_arrow(
            gzfile(path),
            sep,
            skip = 1,
            col_names = cols,
            col_types = paste(
              c("c", "n")[as.integer(cols %in% c(value, time)) + 1L],
              collapse = ""
            )
          )),
          error = function(e) NULL
        )
      }
      if (is.null(d)) {
        results$fail_read <- c(results$fail_read, f)
      } else {
        if (nrow(d)) {
          ck_values <- check_values && length(meta)
          if (missing(check_values) && nrow(d) > 5e6) {
            cli_alert_info(paste(
              "skipping value checks for {.field {f}} due to size ({prettyNum(nrow(d), big.mark = ',')} rows);",
              "set {.arg check_values} to {.pkg TRUE} to force checks"
            ))
            ck_values <- FALSE
          }
          d[[id]] <- sub("^\\s+|\\s+$", "", d[[id]])
          if (!time %in% cols) results$fail_time <- c(results$fail_time, f)
          all_entity_info <- all(entity_info %in% cols)

          if (attempt_repair) {
            repairs <- NULL
            if (!grepl("\\.[bgx]z2?$", f)) repairs <- "warn_compression"
            if (any(cols == "")) {
              repairs <- c(repairs, "warn_blank_colnames")
              d <- d[, cols != ""]
            }
            if (anyNA(d[[value]])) {
              d <- d[!is.na(d[[value]]), ]
              repairs <- c(repairs, "warn_value_nas")
              if (ck_values) d[[value]][is.na(d[[value]])] <- 0
            }
            su <- grep("\\de[+-]?\\d", d[[id]])
            if (length(su)) {
              d[[id]][su] <- gsub(
                "^\\s+|\\s+$",
                "",
                format(as.numeric(d[[id]][su]), scientific = FALSE)
              )
              repairs <- c(repairs, "warn_scientific")
            }
            if (nrow(d)) {
              if (anyNA(d[[id]])) {
                repairs <- c(repairs, "warn_id_nas")
                d <- d[!is.na(d[[id]]), ]
              }
            }
            if (nrow(d)) {
              if (anyNA(d[[value_name]])) {
                repairs <- c(repairs, "warn_value_name_nas")
                d <- d[!is.na(d[[value_name]]), ]
              }
            }
            if (length(dataset_map)) {
              data$dataset <- dataset_map[data[[id]]]
              cols <- c(cols, "dataset")
            }
            if (nrow(d) && dataset %in% cols) {
              if (anyNA(d[[dataset]])) {
                repairs <- c(repairs, "warn_dataset_nas")
                d <- d[!is.na(d[[dataset]]), ]
              }
            }
            if (nrow(d) && time %in% cols) {
              if (anyNA(d[[time]])) {
                repairs <- c(repairs, "warn_time_nas")
                d <- d[!is.na(d[[time]]), ]
              }
            }
            if (nrow(d) && all_entity_info) {
              if (anyNA(d[, entity_info])) {
                repairs <- c(repairs, "warn_entity_info_nas")
                d <- d[rowSums(is.na(d[, entity_info, drop = FALSE])) == 0, ]
              }
            }
            if (ck_values && nrow(d)) {
              md <- split(d[[value]], d[[value_name]])
              for (m in names(md)) {
                mm <- meta[[m]]
                mvs <- md[[m]]
                if (!is.null(mm)) {
                  type <- mm$aggregation_method
                  if (is.null(type) || type == "") {
                    type <- if (
                      !is.null(mm$measure_type) && mm$measure_type == ""
                    )
                      mm$type else mm$measure_type
                    if (is.null(type)) type <- ""
                  }
                  if (grepl("percent", type, fixed = TRUE)) {
                    if (any(mvs > 0) && !any(mvs > 1)) {
                      d[[value]][d[[value_name]] == m] <- d[[value]][
                        d[[value_name]] == m
                      ] *
                        100
                      repairs <- c(repairs, "warn_small_percents")
                    }
                  }
                }
              }
            }
            if (length(repairs)) {
              if (!nrow(d)) {
                if (verbose)
                  cli_alert_danger(
                    "{.strong attempting repairs ({repairs}) removed all rows of {.file {f}}}"
                  )
              } else {
                tf <- sub("\\..+(?:\\.[bgx]z2?)?$", ".csv.xz", path)
                w <- tryCatch(
                  {
                    write.csv(d, xzfile(tf), row.names = FALSE)
                    TRUE
                  },
                  error = function(e) NULL
                )
                if (is.null(w)) {
                  if (verbose)
                    cli_alert_danger(
                      "failed to write repairs ({.field {repairs}}) to {.file {f}}"
                    )
                } else {
                  if (path != tf) {
                    unlink(path)
                  }
                  if (verbose)
                    cli_alert_info(
                      "wrote repairs ({.field {repairs}}) to {.file {tf}}"
                    )
                }
              }
            }
          } else {
            if (!grepl("[bgx]z2?$", f))
              results$warn_compressed <- c(results$warn_compressed, f)
            if (any(cols == ""))
              results$warn_blank_colnames <- c(results$warn_blank_colnames, f)
            if (anyNA(d[[value]])) {
              results$warn_value_nas <- c(results$warn_value_nas, f)
              if (ck_values) d[[value]][is.na(d[[value]])] <- 0
            }
            if (anyNA(d[[id]])) {
              results$warn_id_nas <- c(results$warn_id_nas, f)
              d[[id]][is.na(d[[id]])] <- "NA"
            }
            if (any(grepl("\\de[+-]\\d", d[[id]])))
              results$warn_scientific <- c(results$warn_scientific, f)
            if (anyNA(d[[value_name]])) {
              results$warn_value_name_nas <- c(results$warn_value_name_nas, f)
              d[[value_name]][is.na(d[[value_name]])] <- "NA"
            }
            if (dataset %in% cols && anyNA(d[[dataset]])) {
              results$warn_dataset_nas <- c(results$warn_dataset_nas, f)
              d[[dataset]][is.na(d[[dataset]])] <- "NA"
            }
            if (all_entity_info && anyNA(d[, entity_info]))
              results$warn_entity_info_nas <- c(results$warn_entity_info_nas, f)
            if (time %in% cols && anyNA(d[[time]])) {
              results$warn_time_nas <- c(results$warn_time_nas, f)
              d[[time]][is.na(d[[time]])] <- "NA"
            }
          }

          if (nrow(d)) {
            if (dataset %in% cols) {
              for (l in names(census_geolayers)) {
                if (l %in% d[[dataset]]) {
                  su <- d[[dataset]] == l
                  n_match <- sum(nchar(d[[id]][su]) == census_geolayers[[l]])
                  if (n_match && n_match < sum(su)) {
                    e <- paste0("fail_idlen_", sub(" ", "", l, fixed = TRUE))
                    results[[e]] <- c(results[[e]], f)
                  }
                }
              }
            }

            measures <- unique(d[[value_name]])
            measures <- sort(measures[measures != "NA"])
            su <- !measures %in% rendered_names
            if (any(su))
              su[su] <- !make_full_name(f, measures[su]) %in% names(meta)
            if (any(su))
              results$warn_missing_info[[f]] <- c(
                results$warn_missing_info[[f]],
                measures[su]
              )

            smids <- split(d[[id]], d[[value_name]])
            if (ck_values) md <- split(d[[value]], d[[value_name]])
            for (m in measures) {
              mids <- smids[[m]]
              id_chars <- nchar(mids)
              su <- which(id_chars == 12)
              if (length(su)) {
                su <- su[grep("[^0-9]", mids[su], invert = TRUE)]
                if (
                  length(su) &&
                    !any(unique(substring(mids[su], 1, 11)) %in% mids)
                ) {
                  results$warn_bg_agg[[f]] <- c(results$warn_bg_agg[[f]], m)
                }
              }
              su <- which(id_chars == 11)
              if (length(su)) {
                su <- su[grep("[^0-9]", mids[su], invert = TRUE)]
                if (
                  length(su) &&
                    !any(unique(substring(mids[su], 1, 5)) %in% mids)
                ) {
                  results$warn_tr_agg[[f]] <- c(results$warn_tr_agg[[f]], m)
                }
              }

              if (ck_values) {
                mm <- meta[[m]]
                mvs <- md[[m]]
                if (!is.null(mm)) {
                  type <- mm$aggregation_method
                  if (is.null(type) || type == "") {
                    type <- if (
                      !is.null(mm$measure_type) && mm$measure_type == ""
                    )
                      mm$type else mm$measure_type
                    if (is.null(type)) type <- ""
                  }
                  maxv <- max(mvs)
                  if (grepl("percent", type, fixed = TRUE)) {
                    if (maxv > 0 && !any(mvs > 1)) {
                      results$warn_small_percents[[f]] <- c(
                        results$warn_small_percents[[f]],
                        m
                      )
                    }
                  }
                  if (!is.null(mm$data_type) && mm$data_type == "integer") {
                    if (any(mvs %% 1 != 0)) {
                      results$warn_double_ints[[f]] <- c(
                        results$warn_double_ints[[f]],
                        m
                      )
                    }
                  } else {
                    vm <- min(mvs)
                    if (
                      vm >= 0 && maxv < 1 && mean(mvs > 0 & mvs < 1e-4) > .4
                    ) {
                      results$warn_small_values[[f]] <- c(
                        results$warn_small_values[[f]],
                        m
                      )
                    }
                  }
                }
              }
            }
          }
        } else {
          results$fail_rows <- c(results$fail_rows, f)
        }
      }
    } else {
      results$not_considered <- c(results$not_considered, f)
    }
  }
  if (verbose) cli_progress_done()

  long_paths <- files_short[nchar(files_short) > 140]
  n_long_paths <- length(long_paths)
  if (verbose && n_long_paths) {
    cli_alert_warning(
      "{.strong {n_long_paths} {?path is/paths are} very long (over 140 character):}"
    )
    cli_bullets(structure(
      paste0("(", nchar(long_paths), ") {.field ", long_paths, "}"),
      names = rep(">", n_long_paths)
    ))
  }

  res_summary <- c(FAIL = 0, WARN = 0, SKIP = 0, PASS = 0)
  if (length(results$not_considered)) {
    res_summary["SKIP"] <- length(results$not_considered)
    if (verbose) {
      cli_alert_info(paste(
        '{.strong skipped {res_summary["SKIP"]} file{?/s} because {?it does/they do}',
        "not include all base columns ({.pkg {required}}):}"
      ))
      cli_bullets(structure(
        paste0("{.field ", results$not_considered, "}"),
        names = rep(">", length(results$not_considered))
      ))
    }
  }

  warnings <- unique(unlist(
    lapply(grep("^warn_", sort(names(results)), value = TRUE), function(w) {
      if (is.list(results[[w]])) names(results[[w]]) else results[[w]]
    }),
    use.names = FALSE
  ))
  n_warn <- length(warnings)
  if (n_warn) {
    res_summary["WARN"] <- n_warn
    if (verbose) cli_h2("{n_warn} file{? has/s have} warnings")
    sections <- list(
      warn_compressed = "not compressed:",
      warn_blank_colnames = "contains blank column names:",
      warn_value_nas = "{.pkg {value}} column contains NAs (which are redundant):",
      warn_id_nas = "{.pkg {id}} column contains NAs:",
      warn_scientific = "{.pkg {id}} column appears to contain values in scientific notation:",
      warn_value_name_nas = "{.pkg {value_name}} column contains NAs:",
      warn_dataset_nas = "{.pkg {dataset}} column contains NAs:",
      warn_time_nas = "{.pkg {time}} column contains NAs:",
      warn_entity_info_nas = "entity information column{?/s} ({.pkg {entity_info}}) contain{?s/} NAs:"
    )
    for (s in names(sections)) {
      if (verbose && length(results[[s]])) {
        cli_alert_warning(paste0("{.strong ", sections[[s]], "}"))
        cli_bullets(structure(
          paste0("{.field ", results[[s]], "}"),
          names = rep(">", length(results[[s]]))
        ))
      }
    }
    sections <- list(
      warn_missing_info = "missing measure info entries:",
      warn_small_percents = "no values with a {.pkg percent} type are over 1",
      warn_double_ints = "values with an {.pkg integer} data_type have decimals",
      warn_small_values = "non-zero values are very small (under .00001) -- they will display as 0s",
      warn_bg_agg = "may have block groups that have not been aggregated to tracts:",
      warn_tr_agg = "may have tracts that have not been aggregated to counties:"
    )
    for (s in names(sections)) {
      if (length(results[[s]])) {
        if (verbose) cli_alert_warning(paste0("{.strong ", sections[[s]], "}"))
        if (s == "warn_missing_info")
          meta_base <- sub("^[^:]*:", "", names(meta))
        missing_info <- unlist(
          lapply(
            names(results[[s]]),
            if (s == "warn_missing_info") {
              function(f) {
                vars <- results[[s]][[f]]
                paste0(
                  if (length(vars) > 20) {
                    paste(prettyNum(length(vars), big.mark = ","), "variables")
                  } else {
                    sub(
                      "}, ([^}]+)}$",
                      "}, and \\1}",
                      paste0(
                        paste0("{.pkg ", vars, "}"),
                        vapply(
                          vars,
                          function(m) {
                            w <- meta_base == m
                            if (any(w))
                              paste0(
                                " (base matches {.emph ",
                                names(meta)[which(w)[1]],
                                "})"
                              ) else ""
                          },
                          ""
                        ),
                        collapse = ", "
                      )
                    )
                  },
                  " in {.field ",
                  f,
                  "}"
                )
              }
            } else {
              function(f) {
                vars <- results[[s]][[f]]
                paste0(
                  if (length(vars) > 20) {
                    paste(prettyNum(length(vars), big.mark = ","), "variables")
                  } else {
                    paste0("{.pkg ", vars, "}", collapse = ", ")
                  },
                  " in {.field ",
                  f,
                  "}"
                )
              }
            }
          ),
          use.names = FALSE
        )
        if (verbose)
          cli_bullets(structure(
            missing_info,
            names = rep(">", length(missing_info))
          ))
      }
    }
  }

  failures <- unique(unlist(
    results[grep("^fail_", names(results))],
    use.names = FALSE
  ))
  n_fails <- length(failures)
  if (n_fails) {
    res_summary["FAIL"] <- n_fails
    if (verbose) cli_h2("{n_fails} file{?/s} failed checks")
    sections <- list(
      fail_read = "failed to read in:",
      fail_rows = "contains no data:",
      fail_time = "no {.pkg {time}} column:",
      fail_idlen_county = "not all county GEOIDs are 5 characters long:",
      fail_idlen_tract = "not all tract GEOIDs are 11 characters long:",
      fail_idlen_block_group = "not all block group GEOIDs are 12 characters long:"
    )
    for (s in names(sections)) {
      if (verbose && length(results[[s]])) {
        cli_alert_danger(paste0("{.strong ", sections[[s]], "}"))
        cli_bullets(structure(
          paste0("{.field ", results[[s]], "}"),
          names = rep(">", length(results[[s]]))
        ))
      }
    }
  }

  res_summary["PASS"] <- sum(
    !files_short %in% c(results$not_considered, warnings, failures)
  )
  results$summary <- res_summary

  if (verbose) {
    cat("\n")
    print(res_summary)
  }
  invisible(results)
}
