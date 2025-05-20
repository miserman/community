#' Reformat an SDAD-formatted dataset
#'
#' Unify multiple files, which each contain a tall set of variables associated with regions.
#'
#' The basic assumption is that there are (a) entities which (b) exist in a hierarchy, and
#' (c1) have a static set of features and (c2) a set of variable features which
#' (d) are assessed at multiple time points.
#'
#' For example (and generally), entities are (a) regions, with (b) smaller regions making up larger regions,
#' and which (c1) have names, and (c2) population and demographic counts (d) between 2009 and 2019.
#'
#' @param files A character vector of file paths, or the path to a directory containing data files.
#' @param out Path to a directory to write files to; if not specified, files will not be written.
#' @param variables Vector of variable names (in the \code{value_name} column) to be included.
#' @param ids Vector of IDs (in the \code{id} column) to be included.
#' @param value Name of the column containing variable values.
#' @param value_name Name of the column containing variable names; assumed to be a single variable per file if
#' not present.
#' @param id Column name of IDs which uniquely identify entities.
#' @param time Column name of the variable representing time.
#' @param dataset Column name used to separate entity scales.
#' @param entity_info A list containing variable names to extract and create an ids map from (
#' \code{entity_info.json}, created in the output directory). Entries can be named to rename the
#' variables they refer to in entity features.
#' @param measure_info Measure info to add file information to (as \code{origin}) to, and write to \code{out}.
#' @param metadata A matrix-like object with additional information associated with entities,
#' (such as region types and names) to be merged by \code{id}.
#' @param formatters A list of functions to pass columns through, with names identifying those columns
#' (e.g., \code{list(region_name = function(x) sub(",.*$", "", x))} to strip text after a comma in the
#' "region_name" column).
#' @param compression A character specifying the type of compression to use on the created files,
#' between \code{"gzip"}, \code{"bzip2"}, and \code{"xz"}. Set to \code{FALSE} to disable compression.
#' @param read_existing Logical; if \code{FALSE}, will not read in existing sets.
#' @param overwrite Logical; if \code{TRUE}, will overwrite existing reformatted files, even if
#' the source files are older than it.
#' @param get_coverage Logical; if \code{FALSE}, will not calculate a summary of variable coverage (\code{coverage.csv}).
#' @param verbose Logical; if \code{FALSE}, will not print status messages.
#' @examples
#' dir <- paste0(tempdir(), "/reformat_example")
#' dir.create(dir, FALSE)
#'
#' # minimal example
#' data <- data.frame(
#'   geoid = 1:10,
#'   value = 1
#' )
#' write.csv(data, paste0(dir, "/data.csv"), row.names = FALSE)
#' (data_reformat_sdad(dir))
#'
#' # multiple variables
#' data <- data.frame(
#'   geoid = 1:10,
#'   value = 1,
#'   measure = paste0("v", 1:2)
#' )
#' write.csv(data, paste0(dir, "/data.csv"), row.names = FALSE)
#' (data_reformat_sdad(dir))
#'
#' # multiple datasets
#' data <- data.frame(
#'   geoid = 1:10,
#'   value = 1,
#'   measure = paste0("v", 1:2),
#'   region_type = rep(c("a", "b"), each = 5)
#' )
#' write.csv(data, paste0(dir, "/data.csv"), row.names = FALSE)
#' (data_reformat_sdad(dir))
#' @return An invisible list of the unified variable datasets, split into datasets.
#' @export

data_reformat_sdad <- function(
  files,
  out = NULL,
  variables = NULL,
  ids = NULL,
  value = "value",
  value_name = "measure",
  id = "geoid",
  time = "year",
  dataset = "region_type",
  entity_info = c(type = "region_type", name = "region_name"),
  measure_info = list(),
  metadata = NULL,
  formatters = NULL,
  compression = "xz",
  read_existing = TRUE,
  overwrite = FALSE,
  get_coverage = TRUE,
  verbose = TRUE
) {
  base_dir <- "./"
  if (length(files) == 1 && dir.exists(files)) {
    base_dir <- files
    files <- list.files(files, full.names = TRUE)
  }
  if (any(!file.exists(files))) {
    files <- files[!file.exists(files)]
    cli_abort("file{? does/s do} not exist: {files}")
  }
  if (!is.null(metadata) && !id %in% colnames(metadata))
    cli_abort("{.arg metadata} does not have an id ({id}) column")
  vars <- c(value, value_name, id, time, dataset)
  spec <- c(
    missing(value),
    missing(value_name),
    missing(id),
    missing(time),
    missing(dataset),
    rep(missing(entity_info), length(entity_info))
  )
  data <- list()
  names <- list()
  i <- 0
  if (verbose)
    cli_progress_step(
      "reading in {i}/{length(files)} original file{?s}",
      spinner = TRUE
    )
  max_age <- max(file.mtime(files))
  check_variables <- check_ids <- FALSE
  if (length(ids)) {
    check_ids <- TRUE
    ids <- unique(as.character(ids))
  }
  for (f in files) {
    if (verbose) {
      i <- i + 1
      cli_progress_update()
    }
    d <- attempt_read(f, id)
    if (is.null(d)) {
      if (verbose) cli_warn("failed to read in file: {f}")
      next
    }
    if (!id %in% colnames(d)) {
      if (verbose) cli_warn("file has no ID column: {f}")
      next
    }
    if (anyNA(d[[id]])) d <- d[!is.na(d[[id]]), ]
    if (!nrow(d)) {
      if (verbose) cli_warn("file has no observations: {f}")
      next
    }
    lcols <- tolower(colnames(d))
    if (any(!vars %in% colnames(d))) {
      l <- !colnames(d) %in% vars & lcols %in% vars
      colnames(d)[l] <- lcols[l]
    }
    d[[id]] <- gsub("^\\s+|\\s+$", "", d[[id]])
    if (check_ids) {
      su <- grepl("\\de[+-]\\d", d[[id]], perl = TRUE)
      if (any(su)) {
        d[[id]][su] <- gsub(
          "^\\s+|\\s+$",
          "",
          format(as.numeric(d[[id]][su]), scientific = FALSE)
        )
      }
      su <- d[[id]] %in% ids
      if (!all(su)) d <- d[su, ]
      if (!nrow(d)) {
        if (verbose) cli_warn("file has none of the requested IDs: {f}")
        next
      }
    }
    if (any(su <- !vars %in% colnames(d))) {
      if (all(su)) {
        cli_warn("no variables found in file {f}")
        next
      }
      if (any(!spec[su])) {
        cli_warn(
          "table from {f} does not have {?a column name/column names} {.var {vars[su][!spec[su]]}}"
        )
        next
      }
      vars <- vars[!su]
      spec <- spec[!su]
    }
    names <- c(names, list(colnames(d)))
    if (grepl("repos/", f, fixed = TRUE)) {
      remote <- get_git_remote(sub("(^.+repos/[^/]+/).*$", "\\1.git/config", f))
      if (length(remote)) d$file <- paste0(remote, sub("^.+repos/[^/]+", "", f))
      if (!"file" %in% colnames(d)) d$file <- sub("^.+repos/", "", f)
    } else {
      if (!grepl("/$", base_dir)) base_dir <- paste0(base_dir, "/")
      remote <- get_git_remote(paste0(base_dir, ".git/config"))
      d$file <- gsub(
        "//+",
        "/",
        if (length(remote)) {
          paste0(remote, "/", sub(base_dir, "", f, fixed = TRUE))
        } else {
          sub(base_dir, "", f, fixed = TRUE)
        }
      )
    }
    data <- c(data, list(d))
  }
  if (verbose) cli_progress_done()
  common <- Reduce(intersect, names)
  if (!value %in% vars) {
    a <- common[!common %in% vars]
    if (!length(a))
      cli_abort("could not figure out which column might contain values")
    if (length(a) > 1)
      a <- a[which(vapply(a, function(col) is.numeric(d[[col]]), TRUE))]
    if (!length(a)) {
      cli_abort(c(
        "no potential value columns were numeric",
        i = "check variable classes, or specify {.arg value}"
      ))
    }
    value <- a[1]
    vars <- c(value, vars)
  }
  all <- unique(unlist(names))
  all <- all[all %in% vars & (all == id | !all %in% colnames(metadata))]
  vars <- c(all, "file")
  if (length(variables)) {
    check_variables <- TRUE
    variables <- unique(as.character(variables))
  }
  data <- do.call(
    rbind,
    lapply(seq_along(data), function(i) {
      d <- data[[i]]
      mv <- vars[!vars %in% colnames(d)]
      if (length(mv)) d[, vars[!vars %in% colnames(d)]] <- ""
      d <- d[, vars]
      if (anyNA(d)) d <- d[rowSums(is.na(d)) == 0, ]
      if (check_variables) {
        ovars <- unique(d[[value_name]])
        su <- !ovars %in% variables
        if (any(su)) {
          names(ovars) <- ovars
          ovars[] <- make_full_name(d$file[[1]], ovars)
          su <- su & ovars %in% variables
          for (i in which(su))
            d[[value_name]][d[[value_name]] == names(ovars)[i]] <- ovars[i]
        }
        d <- d[d[[value_name]] %in% variables, ]
      }
      d
    })
  )
  if (is.null(data) || !nrow(data))
    cli_abort("no datasets contained selected variables and/or IDs")
  cn <- colnames(data)
  if (!id %in% vars) {
    id <- "id"
    vars <- c(id, vars)
    data <- cbind(
      id = unlist(lapply(table(data$file), seq_len), use.names = FALSE),
      data
    )
  }
  data[[id]] <- as.character(data[[id]])
  if (!is.null(metadata)) {
    su <- colnames(data) != id & colnames(data) %in% colnames(metadata)
    if (any(su)) data <- data[, colnames(data) == id | !su, drop = FALSE]
    if (verbose)
      cli_progress_step("merging in metadata", msg_done = "merged in metadata")
    metadata <- as.data.frame(metadata[
      !duplicated(metadata[[id]]) & metadata[[id]] %in% data[[id]],
    ])
    if (!nrow(metadata))
      cli_abort("{.arg metadata} had no ids in common with data")
    rownames(metadata) <- metadata[[id]]
    metadata[[id]] <- NULL
    su <- data[[id]] %in% rownames(metadata)
    if (!all(su)) {
      if (verbose)
        cli_warn(
          "{sum(!su)} rows contain IDs not in {.arg metadata} IDs, and will be dropped"
        )
      data <- data[su, ]
    }
    data <- cbind(data, metadata[data[[id]], , drop = FALSE])
    cn <- colnames(data)
    vars <- c(vars, colnames(metadata))
    if (verbose) cli_progress_done()
  }
  if (!is.null(formatters)) {
    for (n in names(formatters)) {
      if (n %in% cn) {
        data[[n]] <- formatters[[n]](data[[n]])
      }
    }
  }
  if (!dataset %in% vars) {
    dataset <- "dataset"
    vars <- c(vars, dataset)
    data$dataset <- dataset
  }
  if (!time %in% vars) {
    time <- "time"
    vars <- c(vars, time)
    data$time <- 1
  }
  if (!any(value_name %in% vars)) {
    vars <- c(vars, value_name)
    data[[value_name]] <- sub("\\.[^.]+$", "", basename(data$file))
  }
  data[[dataset]] <- gsub("\\s+", "_", data[[dataset]])
  datasets <- sort(unique(data[[dataset]]))
  present_vars <- unique(data[[value_name]])
  if (check_variables) {
    present_vars <- variables[variables %in% present_vars]
    if (verbose) {
      absent_variables <- variables[!variables %in% present_vars]
      if (length(absent_variables))
        cli_warn(
          "requested variable{?s} not found in datasets: {.val {absent_variables}}"
        )
    }
  }
  times <- sort(unique(data[[time]]))
  if (all(nchar(times) == 4)) times <- seq(min(times), max(times))
  n <- length(times)
  files <- paste0(out, "/", gsub("\\s+", "_", tolower(datasets)), ".csv")
  if (is.character(compression) && grepl("^[gbx]", compression, FALSE)) {
    compression <- tolower(substr(compression, 1, 1))
    files <- paste0(files, ".", c(g = "gz", b = "bz2", x = "xz")[[compression]])
  } else {
    compression <- FALSE
  }
  names(files) <- datasets
  write <- vapply(
    files,
    function(f)
      is.null(out) || overwrite || !file.exists(f) || max_age > file.mtime(f),
    TRUE
  )
  if (!is.null(out) && (is.list(entity_info) || is.character(entity_info))) {
    entity_info_file <- paste0(out, "/entity_info.json")
    if (overwrite || !file.exists(entity_info_file) || any(write)) {
      entity_info <- as.list(entity_info)
      entity_info <- entity_info[unlist(entity_info) %in% colnames(data)]
      if (length(entity_info)) {
        if (verbose) {
          cli_progress_step(
            "writing entity file",
            msg_done = paste0(
              "wrote entity metadata file: {.file ",
              entity_info_file,
              "}"
            )
          )
        }
        e <- data[, unique(c(id, dataset, unlist(entity_info))), drop = FALSE]
        if (!is.null(names(entity_info))) {
          for (en in names(entity_info)) {
            if (en != "" && entity_info[[en]] %in% colnames(e))
              colnames(e)[colnames(e) == entity_info[[en]]] <- en
          }
        }
        jsonlite::write_json(
          lapply(split(e, e[, 2]), function(g) {
            lapply(
              split(g[, -(1:2), drop = FALSE], g[, 1]),
              function(l) lapply(l, function(r) r[which(r != "")[1]])
            )
          }),
          entity_info_file,
          auto_unbox = TRUE,
          digits = 6
        )
        if (verbose) cli_progress_done()
      }
    }
  }
  svars <- c(id, value, value_name, time, "file", dataset)
  data <- unique(data[, svars[svars %in% vars]])
  if (length(measure_info)) {
    dynamic_names <- render_info_names(measure_info)
  }
  sets <- lapply(datasets, function(dn) {
    if (
      read_existing && !is.null(out) && file.exists(files[[dn]]) && !write[[dn]]
    ) {
      if (verbose)
        cli_progress_step(
          "reading in existing {dn} dataset",
          msg_done = "read existing {dn} dataset"
        )
      read.csv(gzfile(files[[dn]]), check.names = FALSE)
    } else {
      d <- if (dataset %in% vars) data[data[[dataset]] == dn, ] else data
      dc <- list()
      ids <- unique(d[[id]])
      i <- 0
      if (verbose) {
        cli_progress_step(
          "creating {dn} dataset (ID {i}/{length(ids)})",
          msg_done = "created {dn} dataset ({length(ids)} IDs)",
          spinner = TRUE
        )
      }
      d <- d[!duplicated(paste(d[[id]], d[[value_name]], d[[time]])), ]
      if (length(measure_info)) {
        source <- unique(d[, c(value_name, "file")])
        source <- structure(source[[2]], names = source[[1]])
        for (measure in names(source)) {
          iname <- if (length(measure_info[[dynamic_names[measure]]]))
            dynamic_names[measure] else measure
          if (length(measure_info[[iname]])) {
            measure_info[[iname]]$origin <<- unique(c(
              measure_info[[iname]]$origin,
              source[[measure]]
            ))
          }
        }
      }
      sd <- split(d, d[[id]])
      ssel <- c(time, value)
      for (i in seq_along(ids)) {
        if (verbose) cli_progress_update()
        e <- ids[[i]]
        ed <- sd[[e]]
        r <- data.frame(
          ID = rep(as.character(e), n),
          time = times,
          check.names = FALSE,
          matrix(
            NA,
            n,
            length(present_vars),
            dimnames = list(times, present_vars)
          )
        )
        if (all(c(value_name, value) %in% names(ed))) {
          ed <- ed[!is.na(ed[[value]]), ]
          ed <- split(ed[, ssel], ed[[value_name]])
          for (v in names(ed)) {
            vals <- ed[[v]]
            if (nrow(vals)) r[as.character(vals[[time]]), v] <- vals[[value]]
          }
        }
        rownames(r) <- NULL
        dc[[i]] <- r
      }
      do.call(rbind, dc)
    }
  })
  names(sets) <- datasets
  if (length(measure_info)) {
    measure_info_file <- paste0(out, "/measure_info.json")
    if (verbose)
      cli_alert_info("updating measure info: {.file {measure_info_file}}")
    jsonlite::write_json(
      measure_info[sort(names(measure_info))],
      measure_info_file,
      auto_unbox = TRUE,
      pretty = TRUE
    )
  }
  if (!is.null(out)) {
    if (get_coverage && read_existing) {
      if (verbose)
        cli_progress_step(
          "updating coverage report",
          msg_done = "updated coverage report"
        )
      variables <- sort(
        if (length(variables)) variables else
          unique(unlist(lapply(sets, colnames), use.names = FALSE))
      )
      allcounts <- structure(numeric(length(variables)), names = variables)
      write.csv(
        vapply(
          sets,
          function(d) {
            counts <- colSums(!is.na(d))
            counts <- counts[names(counts) %in% variables]
            allcounts[names(counts)] <- counts
            allcounts
          },
          numeric(length(variables))
        ),
        paste0(out, "/coverage.csv")
      )
      if (verbose) cli_progress_done()
    }
    if (any(write)) {
      if (verbose)
        cli_progress_step(
          "writing data files",
          msg_done = "wrote reformatted datasets:"
        )
      for (i in seq_along(sets)) {
        if (write[[i]]) {
          if (is.character(compression))
            o <- do.call(paste0(compression, "zfile"), list(files[[i]]))
          write_csv_arrow(sets[[i]], o)
        }
      }
      if (verbose) {
        cli_progress_done()
        cli_bullets(structure(
          paste0("{.file ", files[write], "}"),
          names = rep("*", sum(write))
        ))
      }
    } else if (verbose) {
      cli_bullets(c(
        v = "all files are already up to date:",
        structure(
          paste0("{.file ", files, "}"),
          names = rep("*", length(files))
        )
      ))
    }
  }
  invisible(sets)
}
