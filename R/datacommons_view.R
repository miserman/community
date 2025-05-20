#' Interact with a Data Commons View
#'
#' Add, edit, or refresh a view within a data commons project.
#'
#' @param commons Path to the data commons project.
#' @param name Name of the view (it's directory in the project's \code{"views"} directory).
#' Defaults to the first view.
#' @param output Path to a site project's main directory.
#' @param ... Passes arguments to \code{\link{data_reformat_sdad}} if the view is to be executed.
#' @param variables A vector of variables, to be added to the view's \code{view.json} file.
#' @param ids A vector of ids, to be added to the view's \code{view.json} file.
#' @param files A regular expression string used to filter files containing \code{variables}.
#' @param run_after Path to a script to be sourced after refreshing the view, or code to
#' be added to such a script (e.g., \code{"../data_site/build.R"}).
#' @param run_before Path to a script to be sourced before refreshing the view, or code to
#' be added to such a script.
#' @param measure_info A list of variable metadata to include in the \code{measure_info.json}
#' file created from such files in each data repository (such as general entries like
#' \code{"_references"}). These will supersede any entries of the same name found in data repositories.
#' @param remote Name of the view's GitHub repository (\code{"username/reponame"}).
#' @param url URL of the view's site; defaults to the GitHub Pages URL associated with \code{remote}
#' if provided (\code{"https://username.github.io/reponame"}).
#' @param children A list of child sites associated with the view. Each entry should contain at least a
#' \code{remote} entry (GitHub repository, including user name and repo name), and optionally \code{name}
#' and \code{url} (link to the served site), which will otherwise be derived from \code{remote}.
#' @param execute Logical; if \code{FALSE}, will create/update, but not run the view.
#' @param prefer_repo Logical; if \code{FALSE}, will prefer distribution files (such as from Dataverse)
#' over those in the repositories.
#' @param preselect_files Logical; if \code{TRUE}, will select files by ID coverage before processing them,
#' which can save time, but might miss data spread across multiple files.
#' @param refresh_map Logical; if \code{TRUE}, overwrites any existing map files.
#' @param overwrite Logical; if \code{TRUE}, reformatted files in \code{output}.
#' @param verbose Logical; if \code{FALSE}, will not show status messages.
#' @examples
#' \dontrun{
#' # create a view within a data commons project
#' datacommons_view(".", "view_name", variables = c("variable_a", "variable_b"))
#'
#' # refresh that view
#' datacommons_view(".", "view_name")
#' }
#' @return An invisible version of the view list (the view's \code{view.json} file).
#' @export

datacommons_view <- function(
  commons,
  name,
  output = NULL,
  ...,
  variables = NULL,
  ids = NULL,
  files = NULL,
  run_after = NULL,
  run_before = NULL,
  measure_info = list(),
  remote = NULL,
  url = NULL,
  children = list(),
  execute = TRUE,
  prefer_repo = TRUE,
  preselect_files = FALSE,
  refresh_map = FALSE,
  overwrite = FALSE,
  verbose = TRUE
) {
  if (missing(commons))
    cli_abort('{.arg commons} must be speficied (e.g., commons = ".")')
  if (missing(name)) {
    name <- list.files(paste0(commons, "/views"))[1]
    if (is.na(name))
      cli_abort(
        "{.arg name} must be specified since no views are present in {commons}"
      )
  }
  check <- check_template("datacommons", dir = commons)
  view_dir <- normalizePath(paste0(commons, "/views/", name), "/", FALSE)
  dir.create(view_dir, FALSE, TRUE)
  paths <- paste0(
    view_dir,
    "/",
    c("view.json", "manifest.json", "run_after.R", "run_before.R")
  )
  base_run_after <- run_after
  if (!is.null(run_after)) {
    if (length(run_after) > 1 || !grepl("\\w\\.\\w+$", run_after)) {
      if (verbose) cli_alert_info("writting {.file run_after.R}")
      writeLines(run_after, paths[3])
      base_run_after <- run_after <- paths[3]
    } else if (!file.exists(run_after)) {
      base_run_after <- paste0(commons, "/", run_after)
    }
  }
  if (
    !is.null(run_before) && (length(run_before) > 1 || !file.exists(run_before))
  ) {
    if (verbose) cli_alert_info("writting {.file run_before.R}")
    writeLines(run_before, paths[4])
    run_before <- paths[4]
  }
  write_view <- FALSE
  if (!is.null(variables)) variables <- variables[!grepl("^_", variables)]
  if (!file.exists(paths[1])) {
    if (verbose) cli_alert_info("writting new {.file view.json}")
    view <- list(
      name = name,
      remote = remote,
      url = url,
      output = output,
      run_after = run_after,
      run_before = run_before,
      variables = variables,
      ids = ids,
      files = files,
      children = children
    )
    write_view <- TRUE
  } else {
    view <- jsonlite::read_json(paths[1])
    if (!is.null(remote) && !identical(view$remote, remote)) {
      view$remote <- remote
      write_view <- TRUE
    }
    if (!is.null(url) && !identical(view$url, url)) {
      view$url <- url
      write_view <- TRUE
    }
    if (!is.null(output) && !identical(view$output, output)) {
      view$output <- output
      write_view <- TRUE
    }
    if (!is.null(run_after) && !identical(view$run_after, run_after)) {
      view$run_after <- run_after
      write_view <- TRUE
    } else if (length(view$run_after)) {
      base_run_after <- view$run_after
      if (!file.exists(base_run_after))
        base_run_after <- paste0(commons, "/", base_run_after)
    }
    if (!is.null(run_before) && !identical(view$run_before, run_before)) {
      view$run_before <- run_before
      write_view <- TRUE
    }
    if (!is.null(variables) && !identical(view$variables, variables)) {
      view$variables <- variables
      write_view <- TRUE
    }
    if (!is.null(ids) && !identical(view$ids, ids)) {
      view$ids <- ids
      write_view <- TRUE
    }
    if (!is.null(ids) && !identical(view$files, files)) {
      view$files <- files
      write_view <- TRUE
    }
    if (!is.null(children) && !identical(view$children, children)) {
      view$children <- children
      write_view <- TRUE
    }
    if (verbose && write_view)
      cli_alert_info("updating existing {.file view.json}")
  }
  outbase <- outdir <- view$output
  if (!is.null(outdir)) {
    if (!dir.exists(outdir)) {
      if (dir.exists(paste0(commons, "/", outdir))) {
        outdir <- paste0(commons, "/", outdir)
      } else {
        dir.create(outdir, FALSE, TRUE)
      }
    }
    outbase <- sub("/docs(?:/data)?$", "", outdir)
  }
  if (length(view$remote)) {
    remote_parts <- strsplit(
      sub("^(?:https?://)?(?:www\\.)?github\\.com/", "", view$remote),
      "/"
    )[[1]]
    if (is.null(view$url))
      view$url <- paste0(
        "https://",
        remote_parts[1],
        ".github.io/",
        remote_parts[2]
      )
    if (!is.null(outdir)) {
      if (!dir.exists(outbase)) {
        outbase <- dirname(outbase)
        dir.create(outbase, FALSE, TRUE)
        wdir <- getwd()
        setwd(outbase)
        if (verbose)
          cli_alert_info(paste0(
            "cloning remote view: {.url https://github.com/",
            view$remote,
            "}"
          ))
        overwrite <- TRUE
        tryCatch(
          system2(
            "git",
            c("clone", paste0("https://github.com/", view$remote, ".git")),
            stdout = TRUE
          ),
          error = function(e) warning("remote clone failed: ", e$message)
        )
        setwd(wdir)
      }
    }
  }
  if (length(view$children)) {
    if (!is.null(names(view$children))) view$children <- list(view$children)
    view$children <- lapply(view$children, function(ch) {
      if (is.null(ch$name)) {
        ch$name <- sub("^.*/", "", ch$remote)
      }
      if (is.null(ch$url)) {
        remote_parts <- strsplit(
          sub("^(?:https?://)?(?:www\\.)?github\\.com/", "", ch$remote),
          "/"
        )[[1]]
        ch$url <- paste0(
          "https://",
          remote_parts[1],
          ".github.io/",
          remote_parts[2]
        )
      }
      ch
    })
  }
  if (length(view$variables)) view$variables <- as.character(view$variables)
  if (length(view$ids)) view$ids <- as.character(view$ids)
  if (!is.null(outbase) && !dir.exists(outbase))
    init_site(outbase, view$name, quiet = TRUE)
  if (is.null(view$output)) outdir <- view_dir
  if (write_view) jsonlite::write_json(view, paths[1], auto_unbox = TRUE)
  if (execute) {
    source_env <- new.env()
    source_env$datacommons_view <- function(...) {
    }
    if (length(view$run_before) && file.exists(view$run_before)) {
      if (verbose)
        cli_alert_info("running pre-view script ({.file {view$run_before}})")
      src <- parse(
        text = gsub(
          "community::datacommons_view",
          "datacommons_view",
          readLines(view$run_before, warn = FALSE),
          fixed = TRUE
        )
      )
      source(local = source_env, exprs = src)
    }
    if (verbose) cli_alert_info("checking for file maps")
    map <- datacommons_map_files(
      commons,
      overwrite = refresh_map,
      verbose = verbose
    )
    files <- map$variables[
      (if (length(view$files)) grepl(view$files, map$variables$file) else
        TRUE) &
        (if (length(view$variables)) {
          map$variables$full_name %in%
            view$variables |
            map$variables$dir_name %in% view$variables |
            map$variables$variable %in% view$variables
        } else {
          TRUE
        }) &
        (if (length(view$ids)) {
          sub("^[^/]+/[^/]+/", "", map$variables$file) %in%
            unique(unlist(
              lapply(map$ids[view$ids %in% names(map$ids)], "[[", "files"),
              use.names = FALSE
            ))
        } else {
          TRUE
        }),
      ,
      drop = FALSE
    ]
    manifest <- NULL
    if (nrow(files)) {
      cfs <- paste0("/", files$file)
      files <- files[
        order(
          grepl(if (prefer_repo) "cache/" else "repos/", files$file) -
            Reduce(
              "+",
              lapply(view$ids, function(id) cfs %in% map$ids[[id]]$file)
            )
        ),
      ]
      files <- files[
        !duplicated(paste(files$dir_name, basename(files$file))),
        ,
        drop = FALSE
      ]
      if (preselect_files) {
        sel_files <- unique(unlist(
          lapply(split(files, files$dir_name), function(fs) {
            if (nrow(fs) == 1) {
              fs$file
            } else {
              ccfs <- sub("^/", "", fs$file)
              ifm <- vapply(
                map$ids[view$ids],
                function(im) ccfs %in% sub("^/", "", im$files),
                logical(length(ccfs))
              )
              is <- colSums(ifm) != 0
              sel <- NULL
              for (i in seq_along(ccfs)) {
                if (any(is[ifm[i, ]])) {
                  sel <- c(sel, fs$file[i])
                  is[ifm[i, ]] <- FALSE
                }
              }
              sel
            }
          }),
          use.names = FALSE
        ))
        files <- files[files$file %in% sel_files, ]
      }
      files <- files[
        order(file.mtime(paste0(commons, "/", files$file)), decreasing = TRUE),
      ]
      if (verbose) cli_alert_info("updating manifest: {.file {paths[2]}}")
      repo_manifest <- jsonlite::read_json(paste0(
        commons,
        "/manifest/repos.json"
      ))
      manifest <- lapply(split(files, files$repo), function(r) {
        hr <- repo_manifest[[r$repo[[1]]]]
        files <- paste0(commons, "/", unique(r$file))
        names(files) <- sub("^[^/]+/[^/]+/", "", unique(r$file))
        list(
          files = lapply(files, function(f) {
            name <- sub("^/[^/]+/[^/]+/", "", sub(commons, "", f, fixed = TRUE))
            if (grepl("repos/", f, fixed = TRUE)) {
              m <- hr$files[[name]]
              m$baseurl <- hr$url
            } else {
              m <- hr$distributions$dataverse$files[[name]]
              m$baseurl <- hr$distributions$dataverse$server
            }
            m
          })
        )
      })
      if (is.character(measure_info)) {
        measure_info <- if (
          length(measure_info) == 1 && file.exists(measure_info)
        ) {
          jsonlite::read_json(measure_info)
        } else {
          as.list(measure_info)
        }
      }
      base_vars <- sub("^[^:/]+[:/]", "", view$variables)
      for (r in unique(files$repo)) {
        measure_info_files <- sort(list.files(
          paste0(commons, "/repos/", sub("^.+/", "", r)),
          "^measure_info[^.]*\\.json$",
          full.names = TRUE,
          recursive = TRUE
        ))
        measure_info_files <- measure_info_files[
          !grepl("/docs/data/", measure_info_files, fixed = TRUE) &
            !duplicated(gsub("_rendered|/code/|/data/", "", measure_info_files))
        ]
        ri <- lapply(measure_info_files, function(f) {
          m <- tryCatch(jsonlite::read_json(f), error = function(e) {
            cli_alert_warning("failed to read measure info: {.file {f}}")
            NULL
          })
          if (all(c("measure", "type", "short_description") %in% names(m))) {
            m <- list(m)
            names(m) <- m[[1]]$measure
          }
          remote <- paste0(
            get_git_remote(sub("(^.+repos/[^/]+/).*$", "\\1.git/config", f)),
            "/"
          )
          source_file <- sub(
            "^/[^/]+/[^/]+/",
            remote,
            sub(commons, "", f, fixed = TRUE)
          )
          for (mn in names(m)) {
            if (substring(mn, 1, 1) != "_") {
              m[[mn]]$source_file <- source_file
            }
          }
          m
        })
        if (length(ri)) {
          ri <- unlist(ri, recursive = FALSE)
          nri <- names(ri)
          if (any(nri == ""))
            for (mname in which(nri == ""))
              names(ri)[mname] <- ri[[mname]]$measure
          es <- nri[substring(nri, 1, 1) == "_" & !nri %in% view$variables]
          if (length(es)) {
            for (e in es) {
              if (!is.null(names(ri[[e]]))) {
                if (is.null(measure_info[[e]])) measure_info[[e]] <- list()
                su <- !names(ri[[e]]) %in% names(measure_info[[e]])
                if (any(su))
                  measure_info[[e]] <- c(measure_info[[e]], ri[[e]][su])
              }
            }
          }
          if (length(view$variables) && any(!nri %in% view$variables)) {
            for (i in seq_along(nri)) {
              n <- nri[i]
              if (n %in% base_vars) {
                names(ri)[i] <- view$variables[which(base_vars == n)[1]]
              } else {
                n <- sub("^[^:]*:", "", nri[i])
                if (n %in% view$variables) {
                  names(ri)[i] <- n
                }
              }
            }
            nri <- names(ri)
          }
          rendered_names <- render_info_names(ri)
          ri <- ri[
            (if (length(view$variables)) {
              nri %in% rendered_names[names(rendered_names) %in% view$variables]
            } else {
              TRUE
            }) &
              !nri %in% names(measure_info)
          ]
          if (length(ri)) {
            measure_info[names(ri)] <- lapply(
              ri,
              function(e)
                if (is.null(names(e)) && !is.null(names(e[[1]]))) e[[1]] else e
            )
          }
        }
      }
      args <- list(...)
      if (length(measure_info)) args$measure_info <- measure_info
      args$files <- paste0(commons, "/", unique(files$file))
      args$out <- outdir
      args$variables <- view$variables
      args$ids <- view$ids
      args$overwrite <- overwrite
      args$verbose <- verbose
      do.call(data_reformat_sdad, args)
    } else {
      cli_warn("no files were found")
    }
    if (length(base_run_after) && file.exists(base_run_after)) {
      if (verbose)
        cli_alert_info("running post-view script ({.file {base_run_after}})")
      src <- parse(
        text = gsub(
          "community::datacommons_view",
          "datacommons_view",
          readLines(base_run_after, warn = FALSE),
          fixed = TRUE
        )
      )
      source(local = source_env, exprs = src)
    }
    jsonlite::write_json(
      manifest,
      paste0(outdir, "/manifest.json"),
      auto_unbox = TRUE,
      pretty = TRUE
    )
  }
  init_datacommons(commons, refresh_after = FALSE, verbose = FALSE)
  invisible(view)
}
